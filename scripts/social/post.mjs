#!/usr/bin/env node
// Auto-post "ready" drafts from Mobile/devto.md, Mobile/hashnode.md,
// Mobile/reddit.md, Mobile/video.md to Dev.to, Hashnode, Reddit and LinkedIn.
// Plain Node ESM, zero dependencies. Node >= 18 (native fetch).
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
const REDDIT_UA = 'roundup-bot/1.0';

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
// platform posting
// ---------------------------------------------------------------------------

async function postDevto(sec) {
  if (!getEnv('DEVTO_API_KEY')) return SKIP;
  const res = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: {
      'api-key': getEnv('DEVTO_API_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      article: {
        title: (sec.fields.title || '').trim(),
        published: true,
        tags: parseTags(sec.fields.tags)
          .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
          .filter(Boolean)
          .slice(0, 4),
        body_markdown: resolveImages(bodyOf(sec)),
      },
    }),
  });
  if (!res.ok) throw new HttpError(res.status, await shortBody(res));
  return true;
}

async function postHashnode(sec) {
  if (!getEnv('HASHNODE_API_TOKEN') || !getEnv('HASHNODE_PUBLICATION_ID')) return SKIP;
  const res = await fetch('https://api.hashnode.com', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getEnv('HASHNODE_API_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'mutation Publish($input: CreatePostInput!) { publishPost(input: $input) { post { id } } }',
      variables: {
        input: {
          title: (sec.fields.title || '').trim(),
          contentMarkdown: resolveImages(bodyOf(sec)),
          publicationId: getEnv('HASHNODE_PUBLICATION_ID'),
          tags: parseTags(sec.fields.tags).map((name) => ({ name })),
        },
      },
    }),
  });
  const data = await readJson(res);
  if (!res.ok || data?.errors) {
    const msg = data?.errors?.[0]?.message || (await shortBody(res));
    throw new HttpError(res.status, msg);
  }
  return true;
}

async function getRedditToken() {
  const auth = Buffer.from(`${getEnv('REDDIT_CLIENT_ID')}:${getEnv('REDDIT_CLIENT_SECRET')}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'User-Agent': REDDIT_UA },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: getEnv('REDDIT_REFRESH_TOKEN') }),
  });
  const data = await readJson(res);
  if (!res.ok || !data?.access_token) {
    throw new HttpError(res.status, data?.message || 'no access_token');
  }
  return data.access_token;
}

async function submitReddit(token, sub, title, text) {
  const form = new URLSearchParams({
    api_type: 'json',
    sr: sub.replace(/^r\//i, ''),
    kind: 'self',
    title,
    text,
    resubmit: 'true',
  });
  const res = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': REDDIT_UA },
    body: form,
  });
  const data = await readJson(res);
  if (!res.ok) throw new HttpError(res.status, await shortBody(res));
  const errors = data?.json?.errors;
  if (errors && errors.length) {
    throw new HttpError(res.status, String(errors[0][1] || errors[0][0]));
  }
  return true;
}

async function postReddit(sec) {
  if (!getEnv('REDDIT_CLIENT_ID') || !getEnv('REDDIT_CLIENT_SECRET') || !getEnv('REDDIT_REFRESH_TOKEN')) {
    return SKIP;
  }
  const token = await getRedditToken();
  const subreddits = parseTags(sec.fields.subreddits);
  for (const sub of subreddits) {
    const subSection = sec.subsections.find((s) => s.heading.toLowerCase().includes(sub.toLowerCase()));
    const target = subSection || sec;
    const title = (target.fields.title || sec.fields.title || '').trim();
    const text = resolveImages(bodyOf(target)).trim();
    await submitReddit(token, sub, title, text);
    await sleep(2000); // be kind to reddit's rate limiter
  }
  return true;
}

async function getLinkedInToken() {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: getEnv('LINKEDIN_REFRESH_TOKEN'),
      client_id: getEnv('LINKEDIN_CLIENT_ID'),
      client_secret: getEnv('LINKEDIN_CLIENT_SECRET'),
    }),
  });
  const data = await readJson(res);
  if (!res.ok || !data?.access_token) {
    throw new HttpError(res.status, data?.error_description || 'no access_token');
  }
  return data.access_token;
}

async function linkedinInitImage(token, owner, imageUrl) {
  const res = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ owner }),
  });
  const data = await readJson(res);
  if (!res.ok || !data?.value?.uploadUrl || !data?.value?.image) {
    throw new HttpError(res.status, data?.message || 'image initializeUpload failed');
  }
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new HttpError(imgRes.status, 'failed to fetch image bytes');
  const up = await fetch(data.value.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: await imgRes.arrayBuffer(),
  });
  if (up.status < 200 || up.status >= 300) {
    throw new HttpError(up.status, 'image upload failed');
  }
  return data.value.image;
}

async function postLinkedIn(sec) {
  if (!getEnv('LINKEDIN_CLIENT_ID') || !getEnv('LINKEDIN_CLIENT_SECRET') || !getEnv('LINKEDIN_REFRESH_TOKEN')) {
    return SKIP;
  }
  const token = await getLinkedInToken();

  const me = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meData = await readJson(me);
  if (!me.ok || !meData?.sub) throw new HttpError(me.status, 'userinfo failed');
  const author = `urn:li:person:${meData.sub}`;

  const raw = bodyOf(sec);
  const imgUrl = findImageUrl(raw);
  const commentary = resolveImages(raw)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // strip markdown image syntax from text
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const post = {
    author,
    lifecycleState: 'PUBLISHED',
    commentary,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
  };

  if (imgUrl) {
    const imageId = await linkedinInitImage(token, author, imgUrl);
    post.content = { media: { id: imageId } };
  }

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(post),
  });
  if (!res.ok) throw new HttpError(res.status, await shortBody(res));
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
