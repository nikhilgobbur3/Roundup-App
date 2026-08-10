#!/usr/bin/env node
// Phase 1 of the startup outreach assistant. Picks 1-2 small YC startups
// (India first, then remote) that we have not contacted yet, scrapes the
// founders + their LinkedIn URLs from the YC company page, and writes the
// batch to pack.json. draft-outreach.mjs turns that batch into GitHub issues.
//
// Needs: GITHUB_TOKEN + GITHUB_REPOSITORY (only for the "how many issues are
// already pending" cap). YC data is public, no keys needed to fetch.
// Optional: OUTREACH_COMPANIES_PER_DAY (default 2).
// Plain Node ESM, zero dependencies.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');
const STATE_FILE = path.join(ROOT, 'scripts', 'outreach', 'state.json');
const PACK_FILE = path.join(ROOT, 'scripts', 'outreach', 'pack.json');
const YC_LIST_URL = 'https://yc-oss.github.io/api/companies/all.json';
const YC_PAGE_BASE = 'https://www.ycombinator.com/companies/';
const MAX_OPEN = 4; // cap of pending outreach issues before we stop fetching
const UA = 'Mozilla/5.0 (compatible; roundup-outreach/1.0; +https://github.com/nikhilgobbur3/Roundup-App)';

// ---------------------------------------------------------------------------
// env (same convention as the reply scripts)
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
const REPO = env.GITHUB_REPOSITORY || '';
const TOKEN = env.GITHUB_TOKEN || '';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const COUNT = Math.max(1, Number(env.OUTREACH_COMPANIES_PER_DAY) || 2);

// ---------------------------------------------------------------------------
// yc helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

async function getPage(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!res.ok) return '';
    return res.text();
  } catch {
    return '';
  }
}

function htmlDecode(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// The YC company page embeds the founders JSON as HTML-entity-encoded JSON
// (&quot; used for every quote). Scan the RAW html using &quot; as the quote
// token, grab the balanced array, decode, then JSON.parse.
function extractFounders(html) {
  const start = html.indexOf('&quot;founders&quot;:[');
  if (start === -1) return null;
  let i = start + '&quot;founders&quot;:'.length;
  const arrStart = i;
  let depth = 0;
  let inStr = false;
  for (; i < html.length; i++) {
    if (html.startsWith('&quot;', i)) {
      const escaped = html[i - 1] === '\\';
      if (!inStr) inStr = true;
      else if (!escaped) inStr = false;
      i += 5;
      continue;
    }
    if (inStr) continue;
    const ch = html[i];
    if (ch === '[') depth++;
    if (ch === ']') { depth--; if (depth === 0) break; }
  }
  const raw = html.slice(arrStart, i + 1);
  try {
    return JSON.parse(htmlDecode(raw));
  } catch {
    return null;
  }
}

async function fetchFounders(slug) {
  let html = await getPage(`${YC_PAGE_BASE}${slug}`);
  if (html.length < 5000) {
    await sleep(6000);
    html = await getPage(`${YC_PAGE_BASE}${slug}`);
  }
  if (html.length < 5000) return null;
  return extractFounders(html);
}

function founderToObj(f, company) {
  return {
    name: String(f?.full_name || '').trim() || `Founder of ${company}`,
    title: String(f?.title || '').trim() || 'Founder',
    linkedin_url: String(f?.linkedin_url || '').trim() || '',
    bio: String(f?.founder_bio || '').trim().replace(/\s+/g, ' ').slice(0, 280),
  };
}

// ---------------------------------------------------------------------------
// github (cap check only)
// ---------------------------------------------------------------------------

async function openOutreachCount() {
  if (!REPO || !TOKEN) return 0; // no token locally -> skip the cap
  let count = 0;
  let url = `https://api.github.com/repos/${REPO}/issues?state=open&per_page=100`;
  while (url) {
    let res;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' } });
    } catch {
      break;
    }
    if (!res.ok) break;
    const items = await (async () => {
      try {
        return await res.json();
      } catch {
        return null;
      }
    })();
    if (!Array.isArray(items)) break;
    for (const item of items) {
      if ((item.body || '').includes('OUTREACH:START')) count++;
    }
    const link = res.headers.get('link') || '';
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : '';
  }
  return count;
}

// ---------------------------------------------------------------------------
// selection
// ---------------------------------------------------------------------------

function placeList(c) {
  const parts = [];
  if (Array.isArray(c.regions)) parts.push(...c.regions);
  if (typeof c.all_locations === 'string') {
    parts.push(...c.all_locations.split(/[;,]/));
  } else if (Array.isArray(c.all_locations)) {
    parts.push(...c.all_locations);
  }
  return parts.map((x) => String(x));
}

function isIndia(c) {
  return placeList(c).some((x) => /india/i.test(x));
}

function isRemote(c) {
  return placeList(c).some((x) => /remote|anywhere/i.test(x));
}

function batchYear(c) {
  const m = String(c.batch || '').match(/(20\d{2})/);
  return m ? Number(m[1]) : 0;
}

function pickCompanies(list, used) {
  const candidates = list.filter((c) => {
    if (String(c.status || '').toLowerCase() !== 'active') return false;
    if (c.top_company === true) return false;
    if (typeof c.all_locations !== 'string' || !c.all_locations.trim()) return false;
    if (used[c.slug]) return false;
    if (typeof c.team_size !== 'number' || c.team_size < 1 || c.team_size > 50) return false;
    return isIndia(c) || isRemote(c);
  });

  const tagBoost = (c) => {
    const tags = (c.tags || []).map((t) => String(t).toLowerCase());
    return tags.includes('fintech') ? 4 : 0;
  };

  candidates.sort((a, b) => {
    if (isIndia(a) !== isIndia(b)) return isIndia(a) ? -1 : 1;
    if (tagBoost(a) !== tagBoost(b)) return tagBoost(b) - tagBoost(a);
    if (batchYear(a) !== batchYear(b)) return batchYear(b) - batchYear(a);
    return a.team_size - b.team_size;
  });

  return candidates;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function readJsonFile(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const state = readJsonFile(STATE_FILE, { used: {}, lastFetch: '' });
const pendingPack = readJsonFile(PACK_FILE, []);

const openCount = await openOutreachCount();
const pendingLocal = Array.isArray(pendingPack) ? pendingPack.length : 0;

if (pendingLocal > 0) {
  console.log(`fetch-startups: ${pendingLocal} company(ies) still pending in pack.json — run draft-outreach.mjs first.`);
  process.exit(0);
}
if (openCount >= MAX_OPEN) {
  console.log(`fetch-startups: ${openCount} outreach issue(s) already open (max ${MAX_OPEN}) — nothing fetched today.`);
  process.exit(0);
}

const all = await getJson(YC_LIST_URL);
if (!Array.isArray(all)) {
  console.log('fetch-startups: could not load YC company list.');
  process.exit(0);
}

const ordered = pickCompanies(all, state.used || {});
console.log(`fetch-startups: ${all.length} companies, ${ordered.length} eligible (India + remote, active, small).`);

const batch = [];
for (const c of ordered) {
  if (batch.length >= COUNT) break;
  console.log(`  trying ${c.slug} (${String(c.one_liner || '').slice(0, 60)}...)...`);
  const founders = await fetchFounders(c.slug);
  if (!founders || founders.length === 0) {
    console.log(`    no founders found — skipping`);
    await sleep(1500);
    continue;
  }
  batch.push({
    slug: c.slug,
    name: String(c.name || c.slug),
    one_liner: String(c.one_liner || '').replace(/\s+/g, ' '),
    batch: String(c.batch || ''),
    team_size: c.team_size,
    locations: String(c.all_locations || ''),
    url: String(c.url || `${YC_PAGE_BASE}${c.slug}`),
    founders: founders.slice(0, 5).map((f) => founderToObj(f, c.slug)),
  });
  console.log(`    ✓ ${founders.length} founder(s)`);
  await sleep(1500);
}

if (batch.length === 0) {
  console.log('fetch-startups: no usable companies this run.');
  process.exit(0);
}

if (CHECK) {
  console.log('\n--- CHECK MODE: would have saved ---');
  console.log(JSON.stringify(batch, null, 2));
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const used = state.used || {};
for (const c of batch) used[c.slug] = today;
state.used = used;
state.lastFetch = today;
writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
writeFileSync(PACK_FILE, JSON.stringify(batch, null, 2) + '\n');

console.log(`fetch-startups: saved ${batch.length} company(ies) to pack.json (${batch.map((c) => c.name).join(', ')}).`);
process.exit(0);
