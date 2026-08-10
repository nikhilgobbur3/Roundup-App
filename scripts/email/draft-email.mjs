#!/usr/bin/env node
// Phase 2 of the cold email outreach assistant. Reads the batch in pack.json
// (companies + their public HR/contact emails from find-emails.mjs), and asks
// Gemini to write a short, genuine, first-person cold email for each one —
// subject + body, plain text, no attachments. Writes the drafted subject/body
// back into pack.json for send-email.mjs.
//
// Needs: GEMINI_API_KEY. Optional: GEMINI_MODEL (default gemini-3.5-flash).
// Plain Node ESM, zero dependencies.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');
const PROFILE_FILE = path.join(ROOT, 'scripts', 'outreach', 'profile.md');
const PACK_FILE = path.join(ROOT, 'scripts', 'email', 'pack.json');
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const MAX_SUBJECT = 90;
const MAX_BODY = 900;

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
const GEMINI_KEY = env.GEMINI_API_KEY || '';

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
// profile.md parsing (shared with draft-outreach.mjs)
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

async function draftEmail(company, profile) {
  const prompt = [
    `You write cold outreach emails for ${profile.intro ? 'a software engineer with this intro: "' + profile.intro + '"' : 'a software engineer'}.`,
    profile.repo ? `Their public project: ${profile.repo}.` : '',
    profile.rules ? `Extra rules: ${profile.rules}` : '',
    '',
    `The recipient is the ${company.email_type === 'hr' ? 'HR / hiring team' : 'contact / team'} at ${company.name}, a startup that "${company.one_liner}".`,
    `Send to: ${company.email}`,
    '',
    'Write ONE short, genuine, first-person cold email asking for a brief chat about joining their engineering team.',
    'It must:',
    '- Be plain text, 3-6 short sentences, no markdown, no emojis, no attachments, no links except the repo.',
    '- Open with something specific about THEIR startup (their one_liner) — not a generic opener.',
    '- Briefly introduce who you are and what you have built (mention the repo only once, naturally).',
    '- End with a single soft, easy-to-answer question. Do NOT demand a call or a slot.',
    '- Sound human, not like a template.',
    '',
    'Return strictly valid JSON: {"subject":"...","body":"..."}',
  ].filter(Boolean).join('\n');

  let res;
  try {
    res = await Promise.race([
      fetch(
        `${GEMINI_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, responseMimeType: 'application/json' },
          }),
        }
      ),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini request timed out')), 45000)),
    ]);
  } catch (err) {
    console.log(`  [gemini] request failed: ${err.message}`);
    return { subject: '', body: '' };
  }
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
      const subject = text.match(/"subject"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const body = text.match(/"body"\s*:\s*"((?:\\.|[^"\\])*)"/);
      parsed = { subject: subject ? subject[1] : '', body: body ? body[1] : '' };
    }
    return {
      subject: trimTo(parsed?.subject, MAX_SUBJECT),
      body: trimTo(parsed?.body, MAX_BODY),
    };
  }
  const err = data?.error?.message || (data ? JSON.stringify(data).slice(0, 200) : `HTTP ${res.status}`);
  console.log(`    [gemini ${MODEL}] draft failed: ${err}`);
  return { subject: '', body: '' };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const profile = readProfile();

const pack = readJsonFile(PACK_FILE, []);
if (!Array.isArray(pack) || pack.length === 0) {
  console.log('draft-email: pack.json empty — nothing to draft.');
  process.exit(0);
}
if (!GEMINI_KEY) {
  console.log('draft-email: missing GEMINI_API_KEY — emails not drafted. Add the secret and rerun.');
  process.exit(0);
}

const remaining = [];
let drafted = 0;

for (const company of pack) {
  if (company.subject && company.body) {
    drafted++;
    remaining.push(company);
    continue;
  }
  const m = await draftEmail(company, profile);
  if (!m.subject || !m.body) {
    const tries = (company.draftTries || 0) + 1;
    company.draftTries = tries;
    if (tries >= 3) {
      console.log(`  ${company.name}: draft failed ${tries} times, dropping from pack`);
    } else {
      console.log(`  ${company.name}: draft failed, keeping for next run (attempt ${tries}/3)`);
      remaining.push(company);
    }
    continue;
  }
  delete company.draftTries;
  company.subject = m.subject;
  company.body = m.body;
  drafted++;
  if (CHECK) {
    console.log(`\n=== ${company.name} → ${company.email} (${company.email_type}) ===`);
    console.log(`Subject: ${company.subject}`);
    console.log(`Body:\n${company.body}`);
  } else {
    console.log(`  ✓ ${company.name}: drafted (${m.subject.length} chars subject, ${m.body.length} chars body)`);
  }
  remaining.push(company);
}

if (CHECK) {
  console.log(`\n--- CHECK MODE: ${drafted} drafted, nothing saved ---`);
  process.exit(0);
}

writeFileSync(PACK_FILE, JSON.stringify(remaining, null, 2) + '\n');
console.log(`draft-email done: ${remaining.length} in pack.json, ${remaining.filter((c) => c.subject && c.body).length} drafted.`);
process.exit(0);
