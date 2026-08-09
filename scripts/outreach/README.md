# Startup Outreach Assistant

Finds 1-2 small YC startups every day (India first, then remote), pulls their
founders' LinkedIn URLs, drafts a short connection note for each founder, and
opens a GitHub issue per company. You tap "send" from your phone — nothing is
auto-sent (LinkedIn blocks bots, and we refuse to risk your account).

## Flow (runs automatically every day at 07:00 IST)

1. `fetch-startups.mjs` — picks companies we haven't contacted yet and saves
   them to `pack.json`.
2. `draft-outreach.mjs` — asks Gemini to write a <190 char note per founder,
   opens one issue per company (`Outreach: <Company>`), then empties
   `pack.json`.
3. The workflow commits the updated state.

## What you do (from your phone)

1. Open the repo → **Issues**. Look for new issues titled `Outreach: ...`.
2. For each founder listed, tap their **Connect** link, hit "Connect", and
   paste the **Send** note (it's already under 190 characters).
3. When a company is fully handled, comment **`done`** on its issue. To skip a
   company, comment **`skip`**. The next daily run closes both.
4. Expect roughly 1-2 companies (2-6 notes) per day — under LinkedIn's weekly
   connection limits, so you stay safe.

## Customize the notes

Edit `scripts/outreach/profile.md` from the GitHub web UI (or on your phone).
It feeds Gemini your intro, repo, and rules. Changes apply on the next run.

## Setup

- Add the `GEMINI_API_KEY` secret to the repo (Settings → Secrets and
  variables → Actions). Without it, notes are never drafted.
- No other secrets needed; `GITHUB_TOKEN` is automatic.

## Manual run

Trigger "Startup Outreach" from the Actions tab (Run workflow). Or locally:

```
node scripts/outreach/fetch-startups.mjs --check   # preview the pick
node scripts/outreach/draft-outreach.mjs --check   # preview the notes
```

`--check` never writes state or opens issues.
