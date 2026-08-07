#!/usr/bin/env node
// Interactive helper to obtain a permanent Reddit refresh token.
// Requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in scripts/.env.
// Opens an authorize URL, then exchanges the code for a refresh token.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');
const UA = 'roundup-bot/1.0';

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function writeEnv(file, env) {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const out = [];
  const written = new Set();
  for (const line of text.split(/\r?\n/)) {
    const key = line.split('=')[0].trim();
    if (env[key] !== undefined && !written.has(key)) {
      out.push(`${key}=${env[key]}`);
      written.add(key);
    } else {
      out.push(line);
    }
  }
  for (const [k, v] of Object.entries(env)) {
    if (k && v !== undefined && !written.has(k)) {
      out.push(`${k}=${v}`);
      written.add(k);
    }
  }
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  writeFileSync(file, out.join(eol) + eol);
}

function extractCode(pasted) {
  const trimmed = pasted.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).searchParams.get('code');
  } catch {
    return null;
  }
}

async function exchangeCode(code, redirectUri, clientId, clientSecret) {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'User-Agent': UA },
    body: form,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok || !data?.refresh_token) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return data.refresh_token;
}

const env = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {};

const clientId = env.REDDIT_CLIENT_ID || '';
const clientSecret = env.REDDIT_CLIENT_SECRET || '';
const redirectUri = env.REDDIT_REDIRECT_URI || 'http://localhost:8080';

if (!clientId || !clientSecret) {
  console.error('REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET must be set in scripts/.env first.');
  process.exit(1);
}

const authUrl =
  'https://www.reddit.com/api/v1/authorize' +
  `?client_id=${encodeURIComponent(clientId)}` +
  '&response_type=code&state=roundup' +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  '&duration=permanent&scope=submit,read';

console.log(`1. Authorize in your browser:\n${authUrl}`);
console.log(`\n2. After approving you'll be redirected to ${redirectUri}.\nPaste the full redirect URL (it contains ?code=...):`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('> ', async (answer) => {
  rl.close();
  const code = extractCode(answer);
  if (!code) {
    console.error('Could not extract a code from that URL.');
    process.exit(1);
  }
  try {
    const refreshToken = await exchangeCode(code, redirectUri, clientId, clientSecret);
    env.REDDIT_REFRESH_TOKEN = refreshToken;
    writeEnv(ENV_FILE, env);
    console.log(`\n✓ REDDIT_REFRESH_TOKEN saved to ${ENV_FILE}`);
  } catch (e) {
    console.error(`\n✗ Failed: ${e.message}`);
    process.exit(1);
  }
});
