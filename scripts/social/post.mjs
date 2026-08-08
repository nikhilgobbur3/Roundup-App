#!/usr/bin/env node
// Auto-post "ready" drafts from Mobile/devto.md, Mobile/hashnode.md,
// Mobile/reddit.md, Mobile/video.md to Dev.to, Hashnode, Reddit and LinkedIn.
// All posting goes through Composio (REST API v3.1) using the platform
// "connected accounts" the user authorizes once at app.composio.dev.
// Plain Node ESM, zero dependencies. Node >= 18 (native fetch).
//
// Secrets: COMPOSIO_API_KEY (required). Optional HASHNODE_PUBLICATION_ID
// to pin which Hashnode publication to publish to (otherwise auto-detected).
//
// Usage:
//   node scripts/social/post.mjs --check   # parse + print ready drafts only
//   node scripts/social/post.mjs           # post ready drafts, mark them back

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');
const MOBILE_DIR = path.join(ROOT, 'Mobile');
const BASE_IMAGE_URL = 'https://raw.githubusercontent.com/nikhilgobbur3/Roundup-App/main/';

const CHECK = process.argv.includes('--check');

const SOURCES = [
  { file: 'devto.md', platform: 'Dev.to' },
  { file: 'hashnode.md', platform: 'Hashnode' },
  { file: 'reddit.md', platform: 'Reddit' },
  { file: 'video.md', platform: 'LinkedIn' },
];

const FIELD_RE = /^\*\*([A-Za-z ]+?):\*\*\s*(.*)$/;
const SKIP = Symbol('skip');
const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// env: process.env first, fallback to scripts/.env (simple KEY=VALUE parser)
// ---------------------------------------------------------------------------

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
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
// draft parsing
// ---------------------------------------------------------------------------

function parseDrafts(mdText) {
  const lines = mdText.split(/\r?\n/);
  const sections = [];
  let sec = null;
  let cur = null;

  const pushBody = (text) => {
    if (!sec) return;
    if (sec.inBody) {
      sec.bodyLines.push(text);
      return;
    }
    if (cur && cur.inBody) cur.bodyLines.push(text);
  };

  const closeSection = () => {
    if (!sec) return;
    if (cur) {
      sec.subsections.push(cur);
      cur = null;
    }
    sections.push(sec);
    sec = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^## /.test(line)) {
      closeSection();
      sec = {
        heading: line.replace(/^##\s+/, ''),
        fields: {},
        bodyLines: [],
        subsections: [],
        inBody: false,
        postedLineIndex: -1,
      };
      continue;
    }

    if (!sec) continue; // preamble before the first ## section

    const f = line.match(FIELD_RE);
    if (f) {
      const name = f[1].trim().toLowerCase();
      const value = f[2].trim();
      const target = cur ? cur : sec;
      if (name === 'body') {
        if (cur) cur.inBody = true;
        else sec.inBody = true;
        continue;
      }
      if (name === 'posted') target.postedLineIndex = i;
      target.fields[name] = value;
      continue;
    }

    if (/^### /.test(line)) {
      // reddit mode: ### lines start subsections
      if (sec.fields.subreddits != null) {
        if (cur) {
          sec.subsections.push(cur);
          cur = null;
        }
        cur = {
          heading: line.replace(/^###\s+/, ''),
          fields: {},
          bodyLines: [],
          inBody: false,
          postedLineIndex: -1,
        };
        continue;
      }
      // article mode: ### lines are just body content
      pushBody(line);
      continue;
    }

    pushBody(line);
  }
  closeSection();
  return sections;
}

function isReady(sec) {
  const date = (sec.fields.date || '').trim();
  const posted = (sec.fields.posted || '').trim();
  if (!date || /^tbd/i.test(date)) return false;
  if (!posted.startsWith('❌')) return false;
  return true;
}

function bodyOf(sec) {
  return sec.bodyLines.join('\n').trim();
}

function parseTags(raw) {
  return (raw || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// content helpers
// ---------------------------------------------------------------------------

function resolveImages(md) {
  return md.replace(/media\/[A-Za-z0-9_./-]+/g, (m) => BASE_IMAGE_URL + m);
}

function findImageUrl(md) {
  const inline = md.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (inline && /^https?:\/\//i.test(inline[1])) return inline[1];
  const direct = md.match(/https?:\/\/[^\s)]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s)]*)?/i);
  return direct ? direct[0] : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// http helpers
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, short) {
    super(short || `HTTP ${status}`);
    this.status = status;
    this.short = short || `HTTP ${status}`;
  }
}

async function shortBody(res) {
  const text = await res.text().catch(() => '');
  if (!text) return res.statusText || `HTTP ${res.status}`;
  try {
    const j = JSON.parse(text);
    if (j && typeof j === 'object') {
      return (
        j.message ||
        j.error_description ||
        j.error ||
        (j.json?.errors?.length ? String(j.json.errors[0][1] || j.json.errors[0][0]) : '') ||
        text.slice(0, 120)
      );
    }
  } catch {}
  return text.slice(0, 120);
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Composio client (REST API v3.1, x-api-key auth, native fetch)
// ---------------------------------------------------------------------------

const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3.1';

const accountCache = new Map();

async function getAccountId(toolkitSlug) {
  if (accountCache.has(toolkitSlug)) return accountCache.get(toolkitSlug);
  const url =
    `${COMPOSIO_BASE}/connected_accounts` +
    `?toolkit_slugs=${encodeURIComponent(toolkitSlug)}&statuses=ACTIVE`;
  const res = await fetch(url, { headers: { 'x-api-key': getEnv('COMPOSIO_API_KEY') } });
  const data = await readJson(res);
  if (!res.ok) throw new HttpError(res.status, await shortBody(res));
  const item = (data?.items || []).find((i) => i.id);
  accountCache.set(toolkitSlug, item?.id || '');
  return item?.id || '';
}

async function executeTool(toolSlug, toolkitSlug, args) {
  const accountId = await getAccountId(toolkitSlug);
  if (!accountId) {
    throw new Error(`${toolkitSlug} not connected in Composio. Connect it once at app.composio.dev.`);
  }
  const res = await fetch(`${COMPOSIO_BASE}/tools/execute/${toolSlug}`, {
    method: 'POST',
    headers: { 'x-api-key': getEnv('COMPOSIO_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ connected_account_id: accountId, arguments: args }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new HttpError(res.status, data?.error?.message || (await shortBody(res)));
  if (!data?.successful) {
    const msg = typeof data?.error === 'string' ? data.error : (data?.error?.message || data?.error || 'tool execution failed');
    throw new HttpError(200, msg);
  }
  return data?.data;
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
// platform posting (all via Composio tools)
// ---------------------------------------------------------------------------

async function postDevto(sec) {
  if (!getEnv('COMPOSIO_API_KEY')) return SKIP;
  await executeTool('DEVTO_CREATE_ARTICLE', 'devto', {
    title: (sec.fields.title || '').trim(),
    published: true,
    body_markdown: resolveImages(bodyOf(sec)),
    tags: parseTags(sec.fields.tags).slice(0, 4),
  });
  return true;
}

async function postHashnode(sec) {
  if (!getEnv('COMPOSIO_API_KEY')) return SKIP;
  let publicationId = getEnv('HASHNODE_PUBLICATION_ID');
  if (!publicationId) {
    const pubs = parseData(await executeTool('HASHNODE_LIST_PUBLICATIONS', 'hashnode', {}));
    publicationId = pubs?.publications?.[0]?.id || pubs?.data?.publications?.[0]?.id || '';
    if (!publicationId) {
      throw new Error('No Hashnode publication found. Set HASHNODE_PUBLICATION_ID to pick one.');
    }
  }
  await executeTool('HASHNODE_PUBLISH_POST', 'hashnode', {
    title: (sec.fields.title || '').trim(),
    contentMarkdown: resolveImages(bodyOf(sec)),
    publicationId,
  });
  return true;
}

async function postReddit(sec) {
  if (!getEnv('COMPOSIO_API_KEY')) return SKIP;
  const subreddits = parseTags(sec.fields.subreddits);
  for (const sub of subreddits) {
    const subSection = sec.subsections.find((s) => s.heading.toLowerCase().includes(sub.toLowerCase()));
    const target = subSection || sec;
    const title = (target.fields.title || sec.fields.title || '').trim();
    const text = resolveImages(bodyOf(target)).trim();
    await executeTool('REDDIT_CREATE_REDDIT_POST', 'reddit', {
      title,
      subreddit: sub.replace(/^r\//i, ''),
      kind: 'self',
      text,
    });
    await sleep(2000); // be kind to reddit's rate limiter
  }
  return true;
}

async function postLinkedIn(sec) {
  if (!getEnv('COMPOSIO_API_KEY')) return SKIP;
  const me = parseData(await executeTool('LINKEDIN_GET_MY_INFO', 'linkedin', {}));
  const personId = me?.sub || me?.id || (typeof me === 'string' ? me : '');
  if (!personId) throw new Error('Could not resolve LinkedIn person id from GET_MY_INFO.');

  const raw = bodyOf(sec);
  const imgUrl = findImageUrl(raw);
  const commentary = resolveImages(raw)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // strip markdown image syntax from text
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const args = {
    author: `urn:li:person:${personId}`,
    commentary,
    visibility: 'PUBLIC',
    lifecycleState: 'PUBLISHED',
  };
  if (imgUrl) args.images = [imgUrl]; // Composio uploads the image for us
  await executeTool('LINKEDIN_CREATE_LINKED_IN_POST', 'linkedin', args);
  return true;
}

const PLATFORMS = {
  'Dev.to': postDevto,
  Hashnode: postHashnode,
  Reddit: postReddit,
  LinkedIn: postLinkedIn,
};

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const drafts = [];
for (const src of SOURCES) {
  const filePath = path.join(MOBILE_DIR, src.file);
  if (!existsSync(filePath)) continue;
  const md = readFileSync(filePath, 'utf8');
  for (const sec of parseDrafts(md)) {
    if (isReady(sec)) drafts.push({ src, sec, filePath });
  }
}

if (CHECK) {
  for (const d of drafts) {
    console.log(`- ${d.src.file}: ${d.sec.heading} (${d.sec.fields.date.trim()})`);
  }
  console.log('');
  console.log(`${drafts.length} ready draft(s). (--check mode: nothing was posted)`);
  process.exit(0);
}

let hadFailure = false;
const marksByFile = new Map(); // filePath -> [lineIndex...]

if (!getEnv('COMPOSIO_API_KEY')) {
  console.log('COMPOSIO_API_KEY is not set — nothing posted. (skip all platforms)');
  process.exit(0);
}

for (const d of drafts) {
  console.log(`- ${d.src.file}: ${d.sec.heading} (${d.sec.fields.date.trim()})`);
  const label = d.sec.fields.title || d.sec.heading;
  try {
    const result = await PLATFORMS[d.src.platform](d.sec);
    if (result === SKIP) {
      console.log(`  (skip ${d.src.platform}: required env missing)`);
      continue;
    }
    console.log(`✓ ${d.src.platform} -> ${label}`);
    if (!marksByFile.has(d.filePath)) marksByFile.set(d.filePath, []);
    marksByFile.get(d.filePath).push(d.sec.postedLineIndex);
  } catch (e) {
    hadFailure = true;
    console.log(`✗ ${d.src.platform} ${e.status ?? ''}: ${e.short || e.message}`);
  }
}

// Mark posted: replace `**Posted:** ❌` with `**Posted:** ✅ <date> (only if file changed)
for (const [filePath, indexes] of marksByFile) {
  const original = readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  let changed = false;
  for (const idx of indexes) {
    if (idx >= 0 && /^\*\*Posted:\*\*/.test(lines[idx])) {
      lines[idx] = `**Posted:** ✅ ${today()}`;
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(filePath, lines.join(eol).replace(new RegExp(`${eol}$`), '') + eol);
    console.log(`✓ wrote posted mark -> ${path.relative(ROOT, filePath)}`);
  }
}

process.exit(hadFailure ? 1 : 0);
