#!/usr/bin/env node
// Phase 3 of the cold email outreach assistant. Instead of sending through
// Brevo, turns each drafted email in pack.json into a GitHub issue — the
// "manual send queue". Each issue shows exactly who to send to, the subject,
// and the full body so you can send it from your own email account. It also
// retires issues where you commented "done" (sent) or "skip".
//
// Needs: GITHUB_TOKEN + GITHUB_REPOSITORY (issues). Optional: EMAIL_SEND_PER_DAY
// (how many new issues to open per run, default 10, max 20).
// Plain Node ESM, zero dependencies. Never exits non-zero.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');
const STATE_FILE = path.join(ROOT, 'scripts', 'email', 'state.json');
const PACK_FILE = path.join(ROOT, 'scripts', 'email', 'pack.json');
const REPO = process.env.GITHUB_REPOSITORY || '';

// ---------------------------------------------------------------------------
// env (same convention as the outreach scripts)
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
const GITHUB_TOKEN = env.GITHUB_TOKEN || '';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const PER_DAY = Math.min(20, Math.max(1, Number(env.EMAIL_SEND_PER_DAY) || 10));

function readJsonFile(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// github
// ---------------------------------------------------------------------------

function ghHeaders() {
  return { Authorization: `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' };
}

async function listOpenIssues() {
  const items = [];
  let url = `https://api.github.com/repos/${REPO}/issues?state=open&per_page=100`;
  while (url) {
    let res;
    try {
      res = await fetch(url, { headers: ghHeaders() });
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
    const m = (res.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : '';
  }
  return items;
}

async function listComments(issueNumber) {
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/issues/${issueNumber}/comments`, { headers: ghHeaders() });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const data = await (async () => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  })();
  return Array.isArray(data) ? data : [];
}

async function closeIssue(issueNumber) {
  try {
    await fetch(`https://api.github.com/repos/${REPO}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: ghHeaders(),
      body: JSON.stringify({ state: 'closed' }),
    });
  } catch {}
}

async function openIssue(company) {
  const body = [
    `## Email: ${company.name}`,
    '',
    `**To:** ${company.email}`,
    `**Subject:** ${company.subject}`,
    '',
    '---',
    '',
    company.body,
    '',
    '---',
    '',
    'Send this email **from your own email account** to the address above, then comment `done` on this issue.',
    'To skip this company, comment `skip`. The daily bot closes both.',
    '',
    'EMAIL:START',
    JSON.stringify(company).replace(/\r?\n/g, ' '),
    'EMAIL:END',
  ].join('\n');

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: ghHeaders(),
      body: JSON.stringify({ title: `Email: ${company.name}`, body }),
    });
    const data = await (async () => {
      try {
        return await res.json();
      } catch {
        return null;
      }
    })();
    return res.ok && data?.number ? data.number : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

// 1) retire issues where the user replied done/skip
const retireSkipped = !CHECK && GITHUB_TOKEN && REPO;
if (retireSkipped) {
  const open = await listOpenIssues();
  for (const issue of open) {
    const body = issue.body || '';
    if (!body.includes('EMAIL:START')) continue;
    const comments = await listComments(issue.number);
    const vote = comments.map((c) => String(c.body || '').trim().toLowerCase()).find((c) => c === 'done' || c === 'skip');
    if (vote) {
      await closeIssue(issue.number);
      console.log(`✓ closed #${issue.number} (${vote})`);
    }
  }
}

// 2) turn drafted emails into issues
const state = readJsonFile(STATE_FILE, { used: {}, sent: {}, issued: {}, lastFetch: '' });
const pack = readJsonFile(PACK_FILE, []);
const ready = Array.isArray(pack) ? pack.filter((c) => c.email && c.subject && c.body) : [];

if (ready.length === 0) {
  console.log('issue-emails: no drafted emails in pack.json — nothing to issue.');
  process.exit(0);
}
if (!GITHUB_TOKEN || !REPO) {
  if (CHECK) {
    console.log(`issue-emails: CHECK MODE — ${ready.length} drafted email(s) ready to issue, would open up to ${PER_DAY}.`);
    process.exit(0);
  }
  console.log('issue-emails: missing GITHUB_TOKEN / GITHUB_REPOSITORY — issues not created.');
  process.exit(0);
}

const issued = state.issued || {};
const alreadyOpen = new Set();
for (const issue of await listOpenIssues()) {
  const m = (issue.body || '').match(/EMAIL:START\s*(\{.*?\})\s*EMAIL:END/s);
  if (m) {
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed.email) alreadyOpen.add(String(parsed.email));
    } catch {}
  }
}

let issuedToday = 0;
const stillPending = [];
const keptOf = (list) => list.filter((c) => !c.email || !c.subject || !c.body);

for (const company of ready) {
  const email = String(company.email || '').trim();
  if (!email) {
    stillPending.push(company);
    continue;
  }
  if (issued[email] || alreadyOpen.has(email)) {
    console.log(`  — ${email}: issue already open, skipping`);
    continue;
  }
  if (issuedToday >= PER_DAY) {
    console.log(`  — daily cap (${PER_DAY}) reached, rest left for next run`);
    stillPending.push(company);
    continue;
  }
  if (CHECK) {
    console.log(`  [check] would open "Email: ${company.name}" → ${email}`);
    issuedToday++;
    stillPending.push(company);
    continue;
  }
  const number = await openIssue(company);
  if (number) {
    issued[email] = number;
    issuedToday++;
    console.log(`✓ issue #${number} opened: Email: ${company.name} → ${email}`);
  } else {
    console.log(`  ✗ ${company.name}: issue open failed, keeping for next run`);
    stillPending.push(company);
  }
}

state.issued = issued;
writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
writeFileSync(PACK_FILE, JSON.stringify([...keptOf(pack), ...stillPending], null, 2) + '\n');

if (CHECK) {
  console.log(`issue-emails: CHECK MODE — would have opened ${issuedToday} issue(s), nothing actually opened.`);
} else {
  console.log(`issue-emails done: opened ${issuedToday} issue(s) today (cap ${PER_DAY}), ${stillPending.length} still pending.`);
}
process.exit(0);
