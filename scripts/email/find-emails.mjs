#!/usr/bin/env node
// Phase 1 of the cold email outreach assistant. Picks small YC startups
// (India first, then remote) that we have not emailed yet, visits their public
// website (homepage + /careers + /contact + /about), and extracts publicly
// published contact emails (careers@, hr@, talent@, hello@, info@, ...).
// Saves the batch (companies that have at least one usable email) to pack.json.
//
// Needs: nothing beyond a network connection (YC data + company sites are
// public). Optional: EMAIL_COMPANIES_PER_DAY (default 10, max 20), and
// EMAIL_SCRAPE_TRIES (how many candidate sites to visit before giving up,
// default 40) — many small sites publish no email at all, so we crawl a buffer.
//
// Plain Node ESM, zero dependencies.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');
const STATE_FILE = path.join(ROOT, 'scripts', 'email', 'state.json');
const PACK_FILE = path.join(ROOT, 'scripts', 'email', 'pack.json');
const YC_LIST_URL = 'https://yc-oss.github.io/api/companies/all.json';
const UA = 'Mozilla/5.0 (compatible; roundup-email/1.0; +https://github.com/nikhilgobbur3/Roundup-App)';

// ---------------------------------------------------------------------------
// env (same convention as the outreach/reply scripts)
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

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const COUNT = Math.min(20, Math.max(1, Number(env.EMAIL_COMPANIES_PER_DAY) || 10));
const TRIES = Math.min(80, Math.max(COUNT, Number(env.EMAIL_SCRAPE_TRIES) || 40));

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPage(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' }, redirect: 'follow', signal: ctrl.signal });
    if (!res.ok) return '';
    const html = await res.text();
    return html.length > 150000 ? html.slice(0, 150000) : html;
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function cleanUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    parsed.hash = '';
    return parsed.href.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function hostname(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function readJsonFile(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// yc selection (same rules as the LinkedIn outreach, minus founders)
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
    if (!String(c.website || '').trim()) return false;
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
// email extraction
// ---------------------------------------------------------------------------

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

function extractEmails(html) {
  const text = htmlDecode(html);
  const found = new Set();
  const re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const email = m[0].toLowerCase().replace(/^\.+|\.+$/g, '');
    if (!email.includes('..') && !email.endsWith('.png') && !email.endsWith('.jpg') && !email.endsWith('.jpeg')) {
      found.add(email);
    }
  }
  return [...found];
}

const HR_PREFIX = /^(careers?|hr|jobs?|talent|recruit(ing|ment)?|people|hiring|work|join(us)?|hiringnow)\b/i;
const CONTACT_PREFIX = /^(hello|contact|info|team|mail|sayhi|enquiries?|enquir(y|ies))\b/i;
const SUPPORT_PREFIX = /^(support|grievance|customers?|help|hellohelp)\b/i;
const BAD_PREFIX = /^(no[-\s]?reply|noreply|webmaster|hostmaster|postmaster|unsubscribe|privacy|security|spam|abuse|devnull)\b/i;

function scoreEmail(email, domain) {
  const [local, d] = email.split('@');
  const onDomain = d === domain;
  const cleanLocal = local.replace(/^[\d_.-]+/, '').replace(/[\d_.-]+$/, '');
  if (BAD_PREFIX.test(cleanLocal)) return -100;
  let score = 0;
  if (HR_PREFIX.test(cleanLocal)) score += 3;
  else if (CONTACT_PREFIX.test(cleanLocal)) score += 2;
  else if (SUPPORT_PREFIX.test(cleanLocal)) score += 1;
  else score += 1;
  if (onDomain) score += 3;
  else score -= 1;
  return score;
}

function pickEmail(emails, domain) {
  if (emails.length === 0) return { email: '', type: '' };
  const scored = emails
    .map((email) => ({ email, score: scoreEmail(email, domain) }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return { email: '', type: '' };
  const type = HR_PREFIX.test(best.email.split('@')[0].replace(/^[\d_.-]+/, '')) ? 'hr' : 'contact';
  return { email: best.email, type };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const state = readJsonFile(STATE_FILE, { used: {}, lastFetch: '' });
const pendingPack = readJsonFile(PACK_FILE, []);
const today = new Date().toISOString().slice(0, 10);
const used = state.used || {};

if (Array.isArray(pendingPack) && pendingPack.length > 0) {
  console.log(`find-emails: ${pendingPack.length} email(s) still pending in pack.json — run draft-email.mjs and send-email.mjs first.`);
  process.exit(0);
}

const all = await (async () => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(YC_LIST_URL, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
})();

if (!Array.isArray(all)) {
  console.log('find-emails: could not load YC company list.');
  process.exit(0);
}

const ordered = pickCompanies(all, state.used || {});
console.log(`find-emails: ${all.length} companies, ${ordered.length} eligible, want ${COUNT} with emails, up to ${TRIES} crawls.`);

const batch = [];
const seen = new Set();
let attempts = 0;

for (const c of ordered) {
  if (batch.length >= COUNT || attempts >= TRIES) break;
  attempts++;
  const website = cleanUrl(c.website);
  if (!website) continue;
  const domain = hostname(website);
  if (!domain || seen.has(domain)) continue;
  seen.add(domain);

  console.log(`  [${attempts}/${TRIES}] ${c.slug} (${domain})...`);
  const pages = [website];
  for (const p of ['/careers', '/career', '/jobs', '/join', '/contact', '/about']) {
    pages.push(website.replace(/\/+$/, '') + p);
  }

  const emails = new Set();
  for (const url of pages) {
    const html = await getPage(url);
    if (html) {
      for (const e of extractEmails(html)) emails.add(e);
    }
    await sleep(300);
  }

  const { email, type } = pickEmail([...emails], domain);
  if (!email) {
    console.log(`    no public email — skipping`);
    used[c.slug] = today;
    continue;
  }

  batch.push({
    slug: c.slug,
    name: String(c.name || c.slug),
    one_liner: String(c.one_liner || '').replace(/\s+/g, ' '),
    batch: String(c.batch || ''),
    team_size: c.team_size,
    locations: String(c.all_locations || ''),
    website,
    email,
    email_type: type,
  });
  console.log(`    ✓ ${email} (${type})`);
  await sleep(300);
}

for (const c of batch) used[c.slug] = today;
state.used = used;
state.lastFetch = today;

if (batch.length === 0) {
  if (!CHECK) {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
    console.log('find-emails: no companies with usable emails this run.');
  } else {
    console.log('find-emails: CHECK MODE — no companies with usable emails this run.');
  }
  process.exit(0);
}

if (CHECK) {
  console.log('\n--- CHECK MODE: would have saved ---');
  console.log(JSON.stringify(batch, null, 2));
  process.exit(0);
}

writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
writeFileSync(PACK_FILE, JSON.stringify(batch, null, 2) + '\n');
console.log(`find-emails: saved ${batch.length} company(ies) with emails to pack.json (${batch.map((c) => c.name).join(', ')}).`);
process.exit(0);
