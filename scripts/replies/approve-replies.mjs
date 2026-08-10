#!/usr/bin/env node
// Phase 2: process GitHub issues created by reply-check.mjs. When the user
// comments "1"/"2"/"3" (or writes a custom reply), post it to Reddit/LinkedIn
// via Composio, comment "Posted" on the issue and close it. "skip" closes it
// without posting. Runs on a schedule alongside reply-check.
//
// Needs: COMPOSIO_API_KEY, GITHUB_TOKEN. Plain Node ESM, zero dependencies.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');
const REPO = process.env.GITHUB_REPOSITORY || '';
const BOT_LOGINS = new Set(['github-actions[bot]', 'roundup-bot']);

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
// helpers
// ---------------------------------------------------------------------------

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
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
  const result = await mcpCall('tools/call', {
    name: 'COMPOSIO_MULTI_EXECUTE_TOOL',
    arguments: {
      tools: [{ tool_slug: toolSlug, arguments: args }],
      sync_response_to_workbench: false,
      thought: `Execute ${toolSlug} for the RoundUp reply pipeline.`,
      memory: {},
      current_step: 'POSTING',
      current_step_metric: '1/1',
    },
  });
  const text = extractToolText(result);
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 160) || 'no tool result');
  }
  const entry = j?.data?.results?.[0]?.response;
  if (!entry) {
    const errMsg = j?.data?.error || j?.error || text.slice(0, 160);
    throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
  }
  if (!entry.successful) {
    const errMsg = entry.error?.message || entry.error || entry.message || 'tool execution failed';
    throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
  }
  return parseData(entry.data);
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

function ghHeaders() {
  return { Authorization: `Bearer ${getEnv('GITHUB_TOKEN')}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' };
}

async function gh(pathname, options = {}) {
  let res;
  try {
    res = await fetch(`https://api.github.com${pathname}`, {
      method: options.method || 'GET',
      headers: ghHeaders(),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    console.log(`  [github] ${options.method || 'GET'} ${pathname} -> network error: ${String(err?.message || err).slice(0, 120)}`);
    return { status: 0, data: null };
  }
  const data = await readJson(res);
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    console.log(`  [github] ${options.method || 'GET'} ${pathname} -> ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return { status: res.status, data };
}

function asArray(data) {
  return Array.isArray(data) ? data : [];
}

async function postReply(meta, reply) {
  if (meta.platform === 'reddit') {
    await executeTool('REDDIT_POST_REDDIT_COMMENT', 'reddit', { text: reply, thing_id: meta.thing_id });
    return;
  }
  if (meta.platform === 'linkedin') {
    const me = await executeTool('LINKEDIN_GET_MY_INFO', 'linkedin', {});
    const personId = me?.sub || me?.id || '';
    if (!personId) throw new Error('Could not resolve LinkedIn person id.');
    await executeTool('LINKEDIN_CREATE_COMMENT_ON_POST', 'linkedin', {
      actor: `urn:li:person:${personId}`,
      object: meta.object,
      target_urn: meta.target_urn,
      message: { text: reply },
    });
    return;
  }
  throw new Error(`Unsupported platform: ${meta.platform}`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

if (!getEnv('COMPOSIO_API_KEY') || !getEnv('GITHUB_TOKEN')) {
  console.log('approve-replies: missing COMPOSIO_API_KEY/GITHUB_TOKEN — nothing processed.');
  process.exit(0);
}
if (!REPO) {
  console.log('approve-replies: GITHUB_REPOSITORY not set.');
  process.exit(0);
}

const issues = await gh(`/repos/${REPO}/issues?state=open&per_page=50`);
let processed = 0;

for (const issue of asArray(issues.data)) {
  if (issue.pull_request) continue;
  const m = String(issue.body || '').match(/REPLY-DRAFT:START\s*([\s\S]*?)\s*REPLY-DRAFT:END/);
  if (!m) continue;

  let meta;
  try {
    meta = JSON.parse(m[1]);
  } catch {
    continue;
  }
  if (!meta.platform || !meta.replies?.length) continue;

  const comments = await gh(`/repos/${REPO}/issues/${issue.number}/comments`);
  let decision = null;
  for (const c of asArray(comments.data)) {
    if (BOT_LOGINS.has(c.user?.login)) continue;
    const text = (c.body || '').trim();
    const pick = text.match(/^\s*([123])\b/);
    if (pick) {
      decision = { kind: 'approve', reply: meta.replies[Number(pick[1]) - 1] };
      break;
    }
    if (/^\s*skip\b/i.test(text)) {
      decision = { kind: 'skip' };
      break;
    }
    decision = { kind: 'custom', reply: text };
    break;
  }

  if (!decision) continue;

  if (decision.kind === 'skip') {
    await gh(`/repos/${REPO}/issues/${issue.number}/comments`, { method: 'POST', body: { body: 'Skipped — no reply posted.' } });
    await gh(`/repos/${REPO}/issues/${issue.number}`, { method: 'PATCH', body: { state: 'closed' } });
    console.log(`- skipped #${issue.number}`);
    processed++;
    continue;
  }

  const reply = (decision.reply || '').trim();
  if (!reply) continue;

  try {
    await postReply(meta, reply);
    await gh(`/repos/${REPO}/issues/${issue.number}/comments`, { method: 'POST', body: { body: `Posted ✅ (${meta.platform})` } });
    await gh(`/repos/${REPO}/issues/${issue.number}`, { method: 'PATCH', body: { state: 'closed' } });
    console.log(`✓ posted #${issue.number} (${meta.platform})`);
  } catch (e) {
    console.log(`✗ #${issue.number}: ${e.message}`);
  }
  processed++;
}

console.log(`approve-replies done: ${processed} issue(s) processed.`);
process.exit(0);
