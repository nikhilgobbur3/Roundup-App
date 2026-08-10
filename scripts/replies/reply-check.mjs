#!/usr/bin/env node
// Phase 2: scan Reddit + LinkedIn for new comments/mentions on our posts,
// have Gemini draft polite replies, and open a GitHub issue per comment so the
// user approves (comment "1"/"2"/"3" or "skip"). Posting happens in
// approve-replies.mjs on a later run.
//
// Needs: COMPOSIO_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN.
// Optional: GEMINI_MODEL (default gemini-3.5-flash).
// Plain Node ESM, zero dependencies.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');
const SEEN_FILE = path.join(ROOT, 'scripts', 'replies', 'seen.json');
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const REPO = process.env.GITHUB_REPOSITORY || '';
const SEEN = { reddit: [], linkedin: [] };

// ---------------------------------------------------------------------------
// env
// ---------------------------------------------------------------------------

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  }
  return out;
}

function loadEnv() {
  const merged = {};
  if (existsSync(ENV_FILE)) Object.assign(merged, parseEnv(readFileSync(ENV_FILE, 'utf8')));
  for (const key of Object.keys(process.env)) {
    if (process.env[key] !== undefined && process.env[key] !== '') merged[key] = process.env[key];
  }
  return merged;
}

const env = loadEnv();
const getEnv = (k) => env[k] || '';

// ---------------------------------------------------------------------------
// shared http helpers
// ---------------------------------------------------------------------------

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function parseData(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// composio (via the Connect/MCP endpoint — the scoped key rejects REST v3.1)
// ---------------------------------------------------------------------------

const MCP_URL = 'https://connect.composio.dev/mcp';
let mcpId = 0;

async function mcpCall(method, params) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'x-consumer-api-key': getEnv('COMPOSIO_API_KEY'),
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++mcpId, method, params }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 120));
  const data = text
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data: '))
    .map((l) => l.slice(6))
    .join('\n');
  let payload;
  try {
    payload = JSON.parse(data);
  } catch {
    throw new Error(text.slice(0, 160) || 'empty MCP response');
  }
  if (payload.error) {
    const msg = typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error);
    throw new Error(msg);
  }
  return payload.result;
}

function extractToolText(result) {
  const content = result?.content;
  if (Array.isArray(content)) {
    const texts = content.filter((c) => c?.type === 'text').map((c) => c.text || '');
    return texts.length ? texts.join('\n') : (content.find((c) => c?.text)?.text || '');
  }
  return result?.content?.text || '';
}

async function executeTool(toolSlug, _toolkitSlug, args) {
  try {
    const result = await mcpCall('tools/call', {
      name: 'COMPOSIO_MULTI_EXECUTE_TOOL',
      arguments: {
        tools: [{ tool_slug: toolSlug, arguments: args }],
        sync_response_to_workbench: false,
        thought: `Execute ${toolSlug} for the RoundUp reply pipeline.`,
        memory: {},
        current_step: 'REPLY_CHECK',
        current_step_metric: '1/1',
      },
    });
    const text = extractToolText(result);
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      return null;
    }
    const entry = j?.data?.results?.[0]?.response;
    if (!entry || !entry.successful) return null;
    return parseData(entry.data);
  } catch {
    return null;
  }
}

async function proxyGet(_toolkitSlug, endpoint) {
  try {
    const result = await mcpCall('tools/call', {
      name: 'COMPOSIO_MULTI_EXECUTE_TOOL',
      arguments: {
        tools: [{ tool_slug: 'HTTPRequest', arguments: { url: `https://api.linkedin.com${endpoint}`, method: 'GET' } }],
        sync_response_to_workbench: false,
        thought: 'Proxy GET for the RoundUp reply pipeline.',
        memory: {},
        current_step: 'REPLY_CHECK',
        current_step_metric: '1/1',
      },
    });
    const text = extractToolText(result);
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      return null;
    }
    const entry = j?.data?.results?.[0]?.response;
    if (!entry || !entry.successful) return null;
    return parseData(entry.data);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// gemini
// ---------------------------------------------------------------------------

async function draftReplies(commentText) {
  const prompt = [
    'You draft replies for a software engineer who shares his open-source project "RoundUp"',
    '(a UPI expense tracker that rounds up payments into savings). Reply in first person as the developer.',
    'Rules:',
    '- Polite, concise, 1-3 sentences.',
    '- On-topic only. If you cannot answer a technical question, say so honestly.',
    '- Never share personal, financial, or private details. Never be defensive or rude.',
    '- Return strictly valid JSON: {"replies":["option 1","option 2","option 3"]}',
    '',
    'Comment to reply to:',
    commentText,
  ].join('\n');

  let res;
  try {
    res = await Promise.race([
      fetch(
        `${GEMINI_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(getEnv('GEMINI_API_KEY'))}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
          }),
        }
      ),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini request timed out')), 45000)),
    ]);
  } catch (err) {
    console.log(`  [gemini] request failed: ${err.message}`);
    return [];
  }
  const data = await readJson(res);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.replies) ? parsed.replies.slice(0, 3).map(String) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// github issues
// ---------------------------------------------------------------------------

function ghHeaders() {
  return { Authorization: `Bearer ${getEnv('GITHUB_TOKEN')}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' };
}

async function openIssue(meta) {
  if (!REPO) return false;
  const body = [
    '## Reply needed',
    '',
    `**Platform:** ${meta.platform}`,
    `**From:** ${meta.from}`,
    meta.url ? `**On:** ${meta.url}` : '',
    '',
    '> ' + String(meta.content || '').replace(/\n+/g, '\n> ').slice(0, 600),
    '',
    '## Suggested replies',
    '',
    ...meta.replies.map((r, i) => `${i + 1}. ${r}`),
    '',
    'Comment `1`, `2`, or `3` to approve, or `skip` to ignore. Any other comment is ignored.',
    '',
    'REPLY-DRAFT:START',
    JSON.stringify(meta).replace(/\r?\n/g, ' '),
    'REPLY-DRAFT:END',
  ].filter(Boolean).join('\n');

  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: ghHeaders(),
      body: JSON.stringify({ title: `Reply needed: ${meta.title}`, body }),
    });
  } catch {
    return false;
  }
  return res.ok;
}

// ---------------------------------------------------------------------------
// collectors
// ---------------------------------------------------------------------------

async function collectReddit() {
  const me = await executeTool('REDDIT_GET_REDDIT_USER_ABOUT', 'reddit', { username: 'me' });
  const username = me?.name || '';
  if (!username) return [];

  const posts = await executeTool('REDDIT_SEARCH_ACROSS_SUBREDDITS', 'reddit', {
    search_query: `author:${username}`,
    result_type: ['link'],
    sort: 'new',
    limit: 10,
  });
  const children = posts?.data?.children || posts?.children || [];
  const found = [];

  for (const child of children) {
    const post = child?.data || child;
    const postId = post?.id;
    if (!postId) continue;
    const comments = await executeTool('REDDIT_RETRIEVE_POST_COMMENTS', 'reddit', {
      article: postId,
      sort: 'new',
      limit: 50,
    });
    const list = comments?.data?.children || comments?.children || [];
    for (const c of list) {
      const d = c?.data;
      if (!d || !d.id) continue;
      if (d.author === username || d.author === '[deleted]' || d.author === '[removed]') continue;
      if (!d.body || d.body === '[deleted]' || d.body === '[removed]') continue;
      const fullname = `t1_${d.id}`;
      if (SEEN.reddit.includes(fullname)) continue;
      SEEN.reddit.push(fullname);
      const url = `https://www.reddit.com${post.permalink || ''}#${fullname}`;
      found.push({
        platform: 'reddit',
        thing_id: fullname,
        url,
        title: `r/${post.subreddit || '?'} comment by u/${d.author}`,
        from: `u/${d.author}`,
        content: d.body,
      });
    }
  }
  return found;
}

async function collectLinkedIn() {
  const me = await executeTool('LINKEDIN_GET_MY_INFO', 'linkedin', {});
  const personId = me?.sub || me?.id || (typeof me === 'string' ? me : '');
  if (!personId) return [];
  const authorUrn = `urn:li:person:${personId}`;

  const posts = await proxyGet('linkedin', `/rest/posts?q=author&author=${encodeURIComponent(authorUrn)}&count=10`);
  const elements = posts?.data?.elements || posts?.elements || [];
  const found = [];

  for (const post of elements) {
    const postUrn = post?.id;
    if (!postUrn) continue;
    const comments = await proxyGet('linkedin', `/rest/socialActions/${encodeURIComponent(postUrn)}/comments?count=20`);
    for (const cm of comments?.data?.elements || comments?.elements || []) {
      const id = cm?.id;
      if (!id) continue;
      const text = cm?.message?.text || '';
      const actor = cm?.actor || '';
      if (!text || actor === authorUrn) continue;
      if (SEEN.linkedin.includes(id)) continue;
      SEEN.linkedin.push(id);
      found.push({
        platform: 'linkedin',
        thing_id: id,
        target_urn: postUrn,
        object: postUrn,
        url: postUrn,
        title: `LinkedIn comment on ${postUrn}`,
        from: actor,
        content: text,
      });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

if (!getEnv('COMPOSIO_API_KEY') || !getEnv('GEMINI_API_KEY') || !getEnv('GITHUB_TOKEN')) {
  console.log('reply-check: missing COMPOSIO_API_KEY/GEMINI_API_KEY/GITHUB_TOKEN — nothing checked.');
  process.exit(0);
}

if (existsSync(SEEN_FILE)) {
  try {
    const s = JSON.parse(readFileSync(SEEN_FILE, 'utf8'));
    if (Array.isArray(s.reddit)) SEEN.reddit = s.reddit;
    if (Array.isArray(s.linkedin)) SEEN.linkedin = s.linkedin;
  } catch {}
}

let total = 0;

for (const item of await collectReddit()) {
  const replies = await draftReplies(item.content);
  if (!replies.length) continue;
  if (await openIssue({ ...item, replies })) {
    total++;
    console.log(`✓ issue opened: ${item.platform} ${item.thing_id}`);
  }
}

for (const item of await collectLinkedIn()) {
  const replies = await draftReplies(item.content);
  if (!replies.length) continue;
  if (await openIssue({ ...item, replies })) {
    total++;
    console.log(`✓ issue opened: ${item.platform} ${item.thing_id}`);
  }
}

writeFileSync(SEEN_FILE, JSON.stringify(SEEN, null, 2) + '\n');
console.log(`reply-check done: ${total} new issue(s), ${SEEN.reddit.length + SEEN.linkedin.length} seen total.`);
process.exit(0);
