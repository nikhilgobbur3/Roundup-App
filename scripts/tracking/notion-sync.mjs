#!/usr/bin/env node
// Sync cold-email + LinkedIn/GitHub outreach progress into the RoundUp Tracking
// Notion database so the user can see and update statuses at a glance.
//
// Data sources:
//   - scripts/email/pack.json + state.json -> Email rows (Pending/Drafted/Sent)
//   - GitHub outreach issues (OUTREACH:START blocks) -> one GitHub row per issue
//     (In Progress / Done) plus one LinkedIn row per founder (Requested).
//
// Status rules (so user edits in Notion are never lost):
//   - Email + GitHub rows: status is pipeline-authoritative, refreshed every run.
//   - LinkedIn rows: status set only on create ("Requested"); updates never touch
//     Status, so the user can flip Accepted/Replied/etc. in Notion freely.
//
// Needs: COMPOSIO_API_KEY (Notion via Connect/MCP). Optional: NOTION_DATABASE_ID
// (default: known "RoundUp Tracking" DB id, then auto-search by title), GITHUB_TOKEN +
// GITHUB_REPOSITORY (GitHub rows). Plain Node ESM, zero dependencies.
// Safety: NEVER exits non-zero (the workflow must stay green and keep committing
// state); failures are logged loudly instead.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');
const EMAIL_PACK = path.join(ROOT, 'scripts', 'email', 'pack.json');
const EMAIL_STATE = path.join(ROOT, 'scripts', 'email', 'state.json');
const MCP_URL = 'https://connect.composio.dev/mcp';
const DB_TITLE = 'RoundUp Tracking';
// Known id of the "RoundUp Tracking" database. Used as a fallback so the sync
// never depends on NOTION_SEARCH_NOTION_PAGE (whose transient failure silently
// skipped row creation on 2026-08-12..14).
const DEFAULT_DATABASE_ID = '3b93042e-33cd-8178-a83b-cf9b7af32700';

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

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const REPO = getEnv('GITHUB_REPOSITORY') || 'nikhilgobbur3/Roundup-App';

// ---------------------------------------------------------------------------
// mcp client (Connect/MCP endpoint)
// ---------------------------------------------------------------------------

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

async function executeTool(toolSlug, args) {
  try {
    const result = await mcpCall('tools/call', {
      name: 'COMPOSIO_MULTI_EXECUTE_TOOL',
      arguments: {
        tools: [{ tool_slug: toolSlug, arguments: args }],
        sync_response_to_workbench: false,
        thought: `Execute ${toolSlug} for the RoundUp Notion tracking sync.`,
        memory: {},
        current_step: 'NOTION_SYNC',
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
    return typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function readJsonFile(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// ---------------------------------------------------------------------------
// row builders
// ---------------------------------------------------------------------------

function emailRows() {
  const pack = readJsonFile(EMAIL_PACK, []);
  const issuedEmails = new Set(emailIssues.value.map((i) => i.email));
  const rows = [];
  for (const item of pack) {
    const email = String(item.email || '').trim();
    if (!email || issuedEmails.has(email)) continue;
    rows.push({
      name: `${item.name || item.slug || email} (${email})`,
      type: 'Email',
      company: item.name || item.slug || '',
      status: item.subject && item.body ? 'Drafted' : 'Pending',
      url: item.website || '',
      notes: [item.subject ? `Subject: ${item.subject}` : '', item.body ? clip(item.body, 300) : ''].filter(Boolean).join('\n'),
    });
  }
  for (const issue of emailIssues.value) {
    const email = issue.email;
    if (!email) continue;
    const name = issue.name || email;
    rows.push({
      name: `${name} (${email})`,
      type: 'Email',
      company: name,
      status: issue.closed ? 'Sent' : 'Drafted',
      url: issue.url || '',
      notes: [issue.subject ? `Subject: ${issue.subject}` : '', issue.body ? clip(issue.body, 300) : ''].filter(Boolean).join('\n'),
    });
  }
  return rows;
}

const emailIssues = { value: [] };

function collectEmailIssues(issues) {
  for (const issue of issues) {
    const body = String(issue.body || '');
    if (!body.includes('EMAIL:START')) continue;
    let item = null;
    const m = body.match(/EMAIL:START\s*(\{.*?\})\s*EMAIL:END/s);
    if (m) {
      try {
        item = JSON.parse(m[1]);
      } catch {}
    }
    if (!item?.email) continue;
    emailIssues.value.push({
      email: String(item.email || '').trim(),
      name: String(item.name || '').trim(),
      subject: String(item.subject || ''),
      body: String(item.body || ''),
      url: issue.html_url || '',
      closed: issue.state === 'closed',
    });
  }
}

function parseFounders(company) {
  return Array.isArray(company?.founders) ? company.founders : [];
}

function founderRows(company) {
  const rows = [];
  const name = company?.name || 'Company';
  for (const f of parseFounders(company)) {
    const founderName = String(f?.name || '').trim();
    if (!founderName) continue;
    rows.push({
      name: `${founderName} — ${name}`,
      type: 'LinkedIn',
      company: name,
      status: 'Requested',
      url: f?.linkedin_url || '',
      notes: [f?.note ? `Send: ${f.note}` : '', f?.followup ? `After accept: ${f.followup}` : ''].filter(Boolean).join('\n'),
    });
  }
  return rows;
}

async function gitHubRows() {
  const issues = await allIssues();
  const rows = [];
  for (const issue of issues) {
    const body = String(issue.body || '');
    if (!body.includes('OUTREACH:START')) continue;
    let company = null;
    const m = body.match(/OUTREACH:START\s*(\{.*?\})\s*OUTREACH:END/s);
    if (m) {
      try {
        company = JSON.parse(m[1]);
      } catch {}
    }
    const cName = company?.name || String(issue.title || '').replace(/^Outreach:\s*/i, '').trim() || `#${issue.number}`;
    rows.push({
      name: `${cName} — Issue #${issue.number}`,
      type: 'GitHub',
      company: cName,
      status: issue.state === 'closed' ? 'Done' : 'In Progress',
      url: issue.html_url || '',
      notes: clip(company?.one_liner, 200) || `Created ${String(issue.created_at || '').slice(0, 10)}`,
    });
    if (company) rows.push(...founderRows(company));
  }
  return rows;
}

let allIssuesCache = null;
async function allIssues() {
  if (!allIssuesCache) {
    const issues = await fetchAllIssues();
    collectEmailIssues(issues);
    allIssuesCache = issues;
  }
  return allIssuesCache;
}

async function fetchAllIssues() {
  const items = [];
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'roundup-bot' };
  if (getEnv('GITHUB_TOKEN')) headers.Authorization = `Bearer ${getEnv('GITHUB_TOKEN')}`;
  for (const state of ['open', 'closed']) {
    let url = `https://api.github.com/repos/${REPO}/issues?state=${state}&per_page=100`;
    while (url) {
      let res;
      try {
        res = await fetch(url, { headers });
      } catch {
        break;
      }
      if (!res.ok) break;
      const page = await (async () => {
        try {
          return await res.json();
        } catch {
          return null;
        }
      })();
      if (!Array.isArray(page)) break;
      items.push(...page);
      const next = (res.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/);
      url = next ? next[1] : '';
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// notion
// ---------------------------------------------------------------------------

async function findDatabaseId() {
  const fromEnv = getEnv('NOTION_DATABASE_ID');
  if (fromEnv) return fromEnv;
  const res = await executeTool('NOTION_SEARCH_NOTION_PAGE', { query: DB_TITLE, filter_value: 'database' });
  const results = res?.results || [];
  for (const r of results) {
    if (r?.object === 'database') return r.id;
  }
  return DEFAULT_DATABASE_ID;
}

function propsFor(row) {
  const base = {
    Name: { title: [{ text: { content: row.name } }] },
    Type: { select: { name: row.type } },
    Company: { rich_text: [{ text: { content: String(row.company || '').slice(0, 2000) } }] },
    Status: { select: { name: row.status } },
    URL: { url: String(row.url || '') },
    Notes: { rich_text: [{ text: { content: String(row.notes || '').slice(0, 2000) } }] },
    Updated: { date: { start: new Date().toISOString().slice(0, 10) } },
  };
  return base;
}

// Email + GitHub rows: status refreshed. LinkedIn rows: create has Status, update does not.
function upsertItemFor(row) {
  const item = {
    match: { property: 'Name', equals: row.name },
    create: { properties: propsFor(row) },
    update: {
      properties: {
        Type: { select: { name: row.type } },
        Company: { rich_text: [{ text: { content: String(row.company || '').slice(0, 2000) } }] },
        URL: { url: String(row.url || '') },
        Notes: { rich_text: [{ text: { content: String(row.notes || '').slice(0, 2000) } }] },
        Updated: { date: { start: new Date().toISOString().slice(0, 10) } },
      },
    },
  };
  if (row.type !== 'LinkedIn') item.update.properties.Status = { select: { name: row.status } };
  return item;
}

async function upsertRows(databaseId, rows) {
  let created = 0;
  let updated = 0;
  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10).map(upsertItemFor);
    const res = await executeTool('NOTION_UPSERT_ROW_DATABASE', { database_id: databaseId, items: chunk });
    const results = res?.results || [];
    for (const r of results) {
      if (r?.action === 'created') created++;
      else if (r?.action === 'updated') updated++;
    }
  }
  return { created, updated };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

if (!getEnv('COMPOSIO_API_KEY')) {
  console.log('notion-sync: missing COMPOSIO_API_KEY — nothing synced.');
  process.exit(0);
}

const github = await gitHubRows();
const rows = [...emailRows(), ...github];

if (CHECK) {
  console.log(`notion-sync CHECK: ${rows.length} row(s) would be synced.`);
  for (const r of rows) console.log(`  ${r.type.padEnd(8)} ${r.name} -> ${r.status}`);
  process.exit(0);
}

if (rows.length === 0) {
  console.log('notion-sync: nothing to sync.');
  process.exit(0);
}

const databaseId = await findDatabaseId();
if (!databaseId) {
  console.log('notion-sync ERROR: database not found — check NOTION_DATABASE_ID / the "RoundUp Tracking" DB.');
  process.exit(0);
}

const { created, updated } = await upsertRows(databaseId, rows);
if (rows.length > 0 && created + updated === 0) {
  console.log(`notion-sync ERROR: ${rows.length} row(s) pending but nothing was created/updated — Notion upsert failed silently.`);
}
console.log(`notion-sync done: ${rows.length} row(s), ${created} created, ${updated} updated (db ${databaseId}).`);
process.exit(0);
