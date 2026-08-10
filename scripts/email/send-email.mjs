#!/usr/bin/env node
// Phase 3 of the cold email outreach assistant. Sends the drafted emails in
// pack.json through the Brevo REST API (https://developers.brevo.com).
// Respects a daily cap (EMAIL_SEND_PER_DAY, default 10, max 20), marks each
// recipient as sent in state.json so we never email the same address twice,
// and leaves the rest of the pack for the next run.
//
// Needs: BREVO_API_KEY (Brevo free plan, 300/day, no card), EMAIL_FROM_NAME
// and EMAIL_FROM_ADDRESS (the address you verify inside Brevo).
// Plain Node ESM, zero dependencies.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');
const STATE_FILE = path.join(ROOT, 'scripts', 'email', 'state.json');
const PACK_FILE = path.join(ROOT, 'scripts', 'email', 'pack.json');
const SEND_URL = 'https://api.brevo.com/v3/smtp/email';

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
const BREVO_KEY = env.BREVO_API_KEY || '';
const FROM_NAME = env.EMAIL_FROM_NAME || '';
const FROM_ADDRESS = env.EMAIL_FROM_ADDRESS || '';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const PER_DAY = Math.min(20, Math.max(1, Number(env.EMAIL_SEND_PER_DAY) || 10));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readJsonFile(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// brevo
// ---------------------------------------------------------------------------

async function sendEmail(company) {
  const payload = {
    sender: { name: FROM_NAME, email: FROM_ADDRESS },
    to: [{ email: company.email }],
    subject: company.subject,
    textContent: company.body,
  };
  let res;
  try {
    res = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        'api-key': BREVO_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.log(`    ✗ ${company.email}: network error: ${String(err?.message || err).slice(0, 120)}`);
    return false;
  }
  const data = await (async () => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  })();
  if (!res.ok) {
    const err = data?.message || data?.error || (data ? JSON.stringify(data).slice(0, 200) : `HTTP ${res.status}`);
    console.log(`    ✗ ${company.email}: Brevo rejected: ${err}`);
    return false;
  }
  console.log(`    ✓ ${company.email}: sent (messageId ${String(data?.messageId || '').slice(0, 16)}...)`);
  return true;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const state = readJsonFile(STATE_FILE, { used: {}, sent: {}, lastFetch: '' });
const pack = readJsonFile(PACK_FILE, []);
const ready = Array.isArray(pack) ? pack.filter((c) => c.email && c.subject && c.body) : [];

if (ready.length === 0) {
  console.log('send-email: no drafted emails in pack.json — nothing to send.');
  process.exit(0);
}
if (!BREVO_KEY) {
  console.log('send-email: missing BREVO_API_KEY — emails not sent. Add the secret and rerun.');
  process.exit(0);
}
if (!FROM_ADDRESS) {
  console.log('send-email: missing EMAIL_FROM_ADDRESS (the verified sender in Brevo).');
  process.exit(0);
}

const sentLog = state.sent || {};
const today = new Date().toISOString().slice(0, 10);
let sentToday = Object.values(sentLog).filter((d) => d === today).length;
const stillPending = [];
const keptOf = (list) => list.filter((c) => !c.email || !c.subject || !c.body);

for (const company of ready) {
  if (sentLog[company.email]) {
    console.log(`  — ${company.email}: already sent, skipping`);
    continue;
  }
  if (sentToday >= PER_DAY) {
    console.log(`  — daily cap (${PER_DAY}) reached, ${ready.length - stillPending.length} left for next run`);
    stillPending.push(company);
    continue;
  }
  if (CHECK) {
    console.log(`  [check] would send to ${company.email} (${company.name})`);
    sentToday++;
    stillPending.push(company);
    continue;
  }
  const ok = await sendEmail(company);
  if (ok) {
    sentLog[company.email] = today;
    sentToday++;
    state.sent = sentLog;
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  } else {
    stillPending.push(company);
  }
  await sleep(1500);
}

state.sent = sentLog;
writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
writeFileSync(PACK_FILE, JSON.stringify([...keptOf(pack), ...stillPending], null, 2) + '\n');

if (CHECK) {
  console.log(`send-email: CHECK MODE — would have sent ${sentToday} today, nothing actually sent.`);
} else {
  console.log(`send-email done: sent ${sentToday} today (cap ${PER_DAY}), ${stillPending.length} still pending.`);
}
process.exit(0);
