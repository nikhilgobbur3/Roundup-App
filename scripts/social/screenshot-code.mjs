#!/usr/bin/env node
// Render highlighted code snippets to PNG using the system's headless
// browser (Edge/Chrome). Zero npm dependencies.
//
// Usage:
//   node scripts/social/screenshot-code.mjs        # generate missing PNGs
//   node scripts/social/screenshot-code.mjs --all  # force regenerate
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const CONFIG_PATH = join(__dirname, "code-shots.json");
const OUT_DIR = join(REPO_ROOT, "media", "code");
const force = process.argv.includes("--all");

// ---------------------------------------------------------------------------
// browser discovery
// ---------------------------------------------------------------------------

function findBrowser() {
  if (process.env.SCREENSHOT_BROWSER) return process.env.SCREENSHOT_BROWSER;
  const candidates = [];
  if (process.platform === "win32") {
    const pf = process.env.ProgramFiles || "C:\\Program Files";
    const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    candidates.push(
      join(pf86, "Microsoft\\Edge\\Application\\msedge.exe"),
      join(pf, "Microsoft\\Edge\\Application\\msedge.exe"),
      join(pf, "Google\\Chrome\\Application\\chrome.exe"),
      join(pf86, "Google\\Chrome\\Application\\chrome.exe")
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    );
  } else {
    candidates.push("chromium", "chromium-browser", "google-chrome", "google-chrome-stable");
  }
  for (const c of candidates) {
    if (c.includes("/") || c.includes("\\")) {
      if (existsSync(c)) return c;
    } else {
      const which = spawnSync("which", [c], { encoding: "utf8" });
      if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// html + snapshot
// ---------------------------------------------------------------------------

const LANG_MAP = {
  tsx: "tsx",
  typescript: "typescript",
  javascript: "javascript",
  jsx: "jsx",
  java: "java",
  json: "json",
  yaml: "yaml",
  sql: "sql",
  python: "python",
};

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(entry, code, escaped) {
  const lang = LANG_MAP[entry.language] || "plaintext";
  const title = escapeHtml(entry.title || basename(entry.file));
  return `<!doctype html><html><head>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<style>
  body { margin:0; background:#0d1117; padding:26px 28px; font-family:Consolas,'Cascadia Code','JetBrains Mono',Menlo,monospace; font-size:14px; line-height:1.55; }
  .bar { display:flex; align-items:center; gap:7px; margin-bottom:18px; }
  .dot { width:11px; height:11px; border-radius:50%; display:inline-block; }
  .title { color:#8b949e; font-size:12.5px; font-family:'Segoe UI',system-ui,sans-serif; margin-left:8px; letter-spacing:.2px; }
  pre { margin:0; }
  code.hljs { background:transparent; padding:0; }
</style></head><body>
<div class="bar">
  <span class="dot" style="background:#ff5f57"></span>
  <span class="dot" style="background:#febc2e"></span>
  <span class="dot" style="background:#28c840"></span>
  <span class="title">${title} &middot; lines ${entry.startLine}&ndash;${entry.endLine}</span>
</div>
<pre><code class="language-${lang}">${escaped}</code></pre>
<script>hljs.highlightAll();</script>
</body></html>`;
}

function snapshot(browser, htmlPath, pngPath, html) {
  const work = join(tmpdir(), "roundup-shots");
  mkdirSync(work, { recursive: true });
  const profile = join(work, "profile-" + Date.now());
  // window-size is a guess; headless --screenshot captures the full page,
  // so generous height is safe.
  const args = [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--disable-extensions",
    "--hide-scrollbars",
    `--user-data-dir=${profile}`,
    "--virtual-time-budget=8000",
    "--window-size=860,560",
    `--screenshot=${pngPath}`,
    "file://" + htmlPath,
  ];
  const res = spawnSync(browser, args, {
    encoding: "utf8",
    timeout: 60000,
    windowsHide: true,
  });
  void html;
  if (res.status !== 0) {
    throw new Error(`browser exited ${res.status}: ${(res.stderr || "").slice(0, 200)}`);
  }
  if (!existsSync(pngPath)) {
    throw new Error("browser finished but no PNG was produced");
  }
  // retry with the "new" headless mode if the legacy mode failed to write anything
  if (readFileSync(pngPath).length === 0) {
    throw new Error("PNG is empty");
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function extractSnippet(entry) {
  const abs = join(REPO_ROOT, entry.file);
  if (!existsSync(abs)) throw new Error(`file not found: ${entry.file}`);
  const lines = readFileSync(abs, "utf8").split(/\r?\n/);
  const slice = lines.slice(entry.startLine - 1, entry.endLine);
  while (slice.length > 0 && slice[slice.length - 1].trim() === "") slice.pop();
  return slice.join("\n");
}

function writeFallback(entry, code) {
  const abs = join(OUT_DIR, `${entry.id}.txt`);
  const header = [
    `// ${entry.title}`,
    `// ${entry.file} (lines ${entry.startLine}-${entry.endLine})`,
    `// Screenshot could not be rendered - plain text fallback.`,
    "",
  ].join("\n");
  writeFileSync(abs, header + code + "\n");
  return abs;
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = findBrowser();
if (!browser) {
  console.error("No headless browser found. Set SCREENSHOT_BROWSER to a chrome/edge binary.");
  process.exit(1);
}
console.log(`browser: ${browser}`);

const entries = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const workDir = join(tmpdir(), "roundup-shots");
mkdirSync(workDir, { recursive: true });

let succeeded = 0;
let failed = 0;

for (const entry of entries) {
  const pngPath = join(OUT_DIR, `${entry.id}.png`);
  try {
    if (!force && existsSync(pngPath) && readFileSync(pngPath).length > 0) {
      console.log(`✓ media/code/${entry.id}.png (skipped, already exists)`);
      succeeded++;
      continue;
    }
    const code = extractSnippet(entry);
    const html = buildHtml(entry, code, escapeHtml(code));
    const htmlPath = join(workDir, `${entry.id}-${Date.now()}.html`);
    writeFileSync(htmlPath, html, "utf8");
    snapshot(browser, htmlPath, pngPath, html);
    const bytes = readFileSync(pngPath).length;
    console.log(`✓ media/code/${entry.id}.png (${bytes} bytes)`);
    succeeded++;
  } catch (err) {
    console.log(`✗ ${entry.id}: ${err.message || err}`);
    try {
      const fallback = writeFallback(entry, extractSnippet(entry));
      console.warn(`  wrote plain text fallback: ${basename(fallback)}`);
    } catch (fallbackErr) {
      console.warn(`  fallback also failed: ${fallbackErr.message || fallbackErr}`);
    }
    failed++;
  }
}

console.log(`\n${succeeded} succeeded, ${failed} failed`);
process.exit(succeeded > 0 ? 0 : 1);
