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
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3.1';
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

const accountCache = new Map();

async function getAccountId(toolkitSlug) {
  if (accountCache.has(toolkitSlug)) return accountCache.get(toolkitSlug);
  const url = `${COMPOSIO_BASE}/connected_accounts?toolkit_slugs=${encodeURIComponent(toolkitSlug)}&statuses=ACTIVE`;
  const res = await fetch(url, { headers: { 'x-api-key': getEnv('COMPOSIO_API_KEY') } });
  const data = await readJson(res);
  const id = (data?.items || []).find((i) => i.id)?.id || '';
  accountCache.set(toolkitSlug, id);
  return id;
}

async function executeTool(toolSlug, toolkitSlug, args) {
  const accountId = await getAccountId(toolkitSlug);
  if (!accountId) throw new Error(`${toolkitSlug} not connected in Composio.`);
  const res = await fetch(`${COMPOSIO_BASE}/tools/execute/${toolSlug}`, {
    method: 'POST',
    headers: { 'x-api-key': getEnv('COMPOSIO_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ connected_account_id: accountId, arguments: args }),
  });
  const data = await readJson(res);
  if (!res.ok || !data?.successful) {
    const msg = data?.error?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data.data;
}

function ghHeaders() {
  return { Authorization: `Bearer ${getEnv('GITHUB_TOKEN')}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' };
}

async function gh(pathname, options = {}) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    method: options.method || 'GET',
    headers: ghHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
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

const issues = await gh('/issues?state=open&per_page=50');
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

  const comments = await gh(`/issues/${issue.number}/comments`);
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
    await gh(`/issues/${issue.number}/comments`, { method: 'POST', body: { body: 'Skipped — no reply posted.' } });
    await gh(`/issues/${issue.number}`, { method: 'PATCH', body: { state: 'closed' } });
    console.log(`- skipped #${issue.number}`);
    processed++;
    continue;
  }

  const reply = (decision.reply || '').trim();
  if (!reply) continue;

  try {
    await postReply(meta, reply);
    await gh(`/issues/${issue.number}/comments`, { method: 'POST', body: { body: `Posted ✅ (${meta.platform})` } });
    await gh(`/issues/${issue.number}`, { method: 'PATCH', body: { state: 'closed' } });
    console.log(`✓ posted #${issue.number} (${meta.platform})`);
  } catch (e) {
    console.log(`✗ #${issue.number}: ${e.message}`);
  }
  processed++;
}

console.log(`approve-replies done: ${processed} issue(s) processed.`);
process.exit(0);
