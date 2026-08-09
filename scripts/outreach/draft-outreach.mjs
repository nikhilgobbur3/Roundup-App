#!/usr/bin/env node
// Phase 2 of the startup outreach assistant. Turns the batch in pack.json into
// GitHub issues, one per company, each listing the founders, their LinkedIn
// URLs, a <190 char Gemini-drafted connection note, and a follow-up message to
// send after the founder accepts. Also retires issues where you commented
// "done" or "skip".
//
// Needs: GEMINI_API_KEY (drafting), GITHUB_TOKEN + GITHUB_REPOSITORY (issues).
// Optional: GEMINI_MODEL (default gemini-3.5-flash).
// Plain Node ESM, zero dependencies.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');
const PROFILE_FILE = path.join(ROOT, 'scripts', 'outreach', 'profile.md');
const PACK_FILE = path.join(ROOT, 'scripts', 'outreach', 'pack.json');
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const MAX_NOTE = 190;
const MAX_FOLLOWUP = 400;
const REPO = process.env.GITHUB_REPOSITORY || '';

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
const GEMINI_KEY = env.GEMINI_API_KEY || '';
const GITHUB_TOKEN = env.GITHUB_TOKEN || '';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');

function readJsonFile(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// profile.md parsing (loose key: value lines)
// ---------------------------------------------------------------------------

function readProfile() {
  const text = existsSync(PROFILE_FILE) ? readFileSync(PROFILE_FILE, 'utf8') : '';
  const out = { intro: '', repo: '', rules: '' };
  const grab = (key) => {
    const m = text.match(new RegExp(`^${key}:([\\s\\S]*?)(?=^\\w[^:]*:|$)`, 'm'));
    return m ? m[1].trim() : '';
  };
  out.intro = grab('Intro');
  out.repo = grab('Repo');
  out.rules = grab('Rules');
  return out;
}

// ---------------------------------------------------------------------------
// gemini
// ---------------------------------------------------------------------------

function trimTo(s, max) {
  let t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length > max) {
    const cut = t.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    t = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim();
  }
  return t;
}

async function draftMessages(founder, company, profile) {
  const prompt = [
    `You write LinkedIn messages for ${profile.intro ? 'a software engineer with this intro: "' + profile.intro + '"' : 'a software engineer'}.`,
    profile.repo ? `Their public project: ${profile.repo}.` : '',
    profile.rules ? `Extra rules: ${profile.rules}` : '',
    '',
    `The recipient is ${founder.name}, ${founder.title} at ${company.name} (${company.one_liner}).`,
    '',
    'Write TWO short, genuine, first-person messages from the engineer:',
    '1. "note": the LinkedIn connection-request note (sent with the Connect button).',
    `   - ${MAX_NOTE} characters or fewer.`,
    '   - Tie it briefly to THEIR work (' + company.one_liner + '), then one line about who you are.',
    '   - Do NOT ask for anything. Just introduce and connect.',
    `2. "followup": the message to send AFTER the recipient accepts the connection.`,
    `   - ${MAX_FOLLOWUP} characters or fewer, 2-4 sentences.`,
    '   - Warm, thank them briefly, restate genuine interest in their startup, and end with a soft question they can answer easily.',
    '   - Still first person, still no job, referral, or favor request.',
    '',
    'Rules for both: plain text, no markdown, no emojis, no hashtags, no line breaks.',
    'Return strictly valid JSON: {"note":"...","followup":"..."}',
  ].filter(Boolean).join('\n');

  const res = await fetch(
    `${GEMINI_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, responseMimeType: 'application/json' },
      }),
    }
  );
  const data = await (async () => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  })();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text) {
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const note = text.match(/"note"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const followup = text.match(/"followup"\s*:\s*"((?:\\.|[^"\\])*)"/);
      parsed = { note: note ? note[1] : '', followup: followup ? followup[1] : '' };
    }
    return {
      note: trimTo(parsed?.note, MAX_NOTE),
      followup: trimTo(parsed?.followup, MAX_FOLLOWUP),
    };
  }
  const err = data?.error?.message || (data ? JSON.stringify(data).slice(0, 200) : `HTTP ${res.status}`);
  console.log(`    [gemini ${MODEL}] draft failed: ${err}`);
  return { note: '', followup: '' };
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
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) break;
    const page = await res.json();
    items.push(...page);
    const m = (res.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : '';
  }
  return items;
}

async function listComments(issueNumber) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues/${issueNumber}/comments`, { headers: ghHeaders() });
  if (!res.ok) return [];
  return res.json();
}

async function closeIssue(issueNumber) {
  await fetch(`https://api.github.com/repos/${REPO}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers: ghHeaders(),
    body: JSON.stringify({ state: 'closed' }),
  });
}

async function openIssue(company) {
  const sections = [`## Outreach: ${company.name}`];
  sections.push(
    `**${company.batch || 'YC'}** · ~${company.team_size} people · ${company.locations || '?'}`,
    `${company.one_liner}`,
    `${company.url}`,
    '',
    'Send LinkedIn connection requests to the people below:',
    ''
  );
  company.founders.forEach((f, i) => {
    sections.push(`### ${i + 1}. ${f.name} — ${f.title}`);
    if (f.bio) sections.push(`> ${f.bio}`);
    if (f.linkedin_url) {
      sections.push(`**Connect:** ${f.linkedin_url}`);
    } else {
      sections.push(`**Connect:** LinkedIn URL not published — search **"${f.name} ${company.name}"** on LinkedIn and send the note.`);
    }
    sections.push(`**Send:** ${f.note}`);
    if (f.followup) sections.push(`**After they accept — send:** ${f.followup}`);
    sections.push('');
  });
  sections.push(
    '- Open each LinkedIn link above and hit "Connect", then paste the "Send" note.',
    '- If a founder accepts, send them the "After they accept — send:" message.',
    '- When a company is fully handled, comment `done` on its issue.',
    '- To skip a company, comment `skip`. The daily bot closes both.',
    '',
    'OUTREACH:START',
    JSON.stringify(company).replace(/\r?\n/g, ' '),
    'OUTREACH:END'
  );

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({ title: `Outreach: ${company.name}`, body: sections.filter(Boolean).join('\n') }),
  });
  return res.ok;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const profile = readProfile();

// 1) retire issues where the user replied done/skip
const retireSkipped = !CHECK && GITHUB_TOKEN && REPO;
if (retireSkipped) {
  const open = await listOpenIssues();
  for (const issue of open) {
    const body = issue.body || '';
    if (!body.includes('OUTREACH:START')) continue;
    const comments = await listComments(issue.number);
    const vote = comments.map((c) => String(c.body || '').trim().toLowerCase()).find((c) => c === 'done' || c === 'skip');
    if (vote) {
      await closeIssue(issue.number);
      console.log(`✓ closed #${issue.number} (${vote})`);
    }
  }
}

// 2) turn pack.json into issues
const pack = readJsonFile(PACK_FILE, []);
if (!Array.isArray(pack) || pack.length === 0) {
  console.log('draft-outreach: pack.json empty — nothing to issue.');
  process.exit(0);
}
if (!GEMINI_KEY) {
  console.log('draft-outreach: missing GEMINI_API_KEY — issues not created. Add the secret and rerun.');
  process.exit(0);
}

let openSlugs = [];
if (GITHUB_TOKEN && REPO) {
  const open = await listOpenIssues();
  openSlugs = open
    .filter((i) => (i.body || '').includes('OUTREACH:START'))
    .map((i) => {
      const m = (i.body || '').match(/OUTREACH:START\s*(\{.*?\})\s*OUTREACH:END/s);
      try {
        return m ? JSON.parse(m[1]).slug : '';
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

const remaining = [];
for (const company of pack) {
  if (openSlugs.includes(company.slug)) {
    console.log(`✓ ${company.name}: issue already open, skipping`);
    continue;
  }
  if (CHECK) {
    console.log(`\n=== ${company.name} (${company.batch}) ===`);
    for (const f of company.founders) {
      const m = await draftMessages(f, company, profile);
      console.log(`  ${f.name} | ${f.title}`);
      console.log(`  linkedin: ${f.linkedin_url || '(none)'}`);
      console.log(`  note(${m.note.length}): ${m.note}`);
      if (m.followup) console.log(`  followup(${m.followup.length}): ${m.followup}`);
    }
    continue;
  }
  let ok = true;
  for (const f of company.founders) {
    const m = await draftMessages(f, company, profile);
    if (!m.note) { ok = false; break; }
    f.note = m.note;
    if (m.followup) f.followup = m.followup;
  }
  if (!ok) {
    console.log(`  ${company.name}: note draft failed, keeping for next run`);
    remaining.push(company);
    continue;
  }
  if (await openIssue(company)) {
    console.log(`✓ issue opened: ${company.name}`);
  } else {
    console.log(`  ${company.name}: issue open failed, keeping for next run`);
    remaining.push(company);
  }
}

writeFileSync(PACK_FILE, JSON.stringify(remaining, null, 2) + '\n');
console.log(`draft-outreach done: ${remaining.length} company(ies) still pending.`);
process.exit(0);
