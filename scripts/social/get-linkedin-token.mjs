#!/usr/bin/env node
// Interactive helper to obtain a LinkedIn refresh token (and access token).
// Requires LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in scripts/.env.
// Opens an authorize URL, then exchanges the code for tokens.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = path.join(ROOT, 'scripts', '.env');

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
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok || !data?.refresh_token) {
    throw new Error(data?.error_description || data?.error || `HTTP ${res.status}`);
  }
  return data;
}

const env = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {};

const clientId = env.LINKEDIN_CLIENT_ID || '';
const clientSecret = env.LINKEDIN_CLIENT_SECRET || '';
const redirectUri = env.LINKEDIN_REDIRECT_URI || 'http://localhost:8080';

if (!clientId || !clientSecret) {
  console.error('LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set in scripts/.env first.');
  process.exit(1);
}

// r_refresh_token is included so LinkedIn returns a refresh_token for the pipeline.
const scope = 'openid profile email w_member_social r_refresh_token';
const authUrl =
  'https://www.linkedin.com/oauth/v2/authorization' +
  '?response_type=code' +
  `&client_id=${encodeURIComponent(clientId)}` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&scope=${encodeURIComponent(scope)}` +
  '&state=roundup';

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
    const data = await exchangeCode(code, redirectUri, clientId, clientSecret);
    env.LINKEDIN_REFRESH_TOKEN = data.refresh_token;
    if (data.access_token) env.LINKEDIN_ACCESS_TOKEN = data.access_token;
    writeEnv(ENV_FILE, env);
    console.log(`\n✓ LINKEDIN_REFRESH_TOKEN saved to ${ENV_FILE}`);
    if (data.access_token) console.log('✓ LINKEDIN_ACCESS_TOKEN also saved');
  } catch (e) {
    console.error(`\n✗ Failed: ${e.message}`);
    process.exit(1);
  }
});
