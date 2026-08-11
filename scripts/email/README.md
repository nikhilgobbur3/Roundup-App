# Cold Email Outreach Assistant

Prepares personalized cold emails to small YC startups (India first, then remote)
whose HR/contact addresses are **publicly published** on their websites. It finds
the emails and drafts each message with Gemini, then opens a **GitHub issue per
email** so you can send it from your own email account — the bot never sends
anything itself.

## Flow (runs automatically every day at 08:00 IST, after the LinkedIn batch)

1. `find-emails.mjs` — picks companies we haven't emailed yet, crawls their
   website (homepage + /careers + /contact + /about) for public contact emails,
   and saves the batch to `pack.json`.
2. `draft-email.mjs` — Gemini writes a short, genuine, first-person email per
   company (subject + body) using `scripts/outreach/profile.md`.
3. `issue-emails.mjs` — opens up to **10/day (max 20)** GitHub issues titled
   `Email: <Company>`, each showing the recipient, subject, and full body. It
   also closes issues where you commented `done` (sent) or `skip`.
4. The workflow commits the updated state, and `notion-sync.mjs` mirrors the
   email issues to Notion (open = `Drafted`, closed = `Sent`).

## How to send

1. Open the GitHub issue `Email: <Company>` (Issues tab → filter `Email:`).
2. Copy the body, open your own email client, and send it to the `To:` address.
3. Comment `done` on the issue once sent, or `skip` to skip the company.
4. The next daily run closes the issue and Notion flips it to `Sent`.

## Setup

- `GITHUB_TOKEN` + `GITHUB_REPOSITORY` — already used by the LinkedIn bot.
- `GEMINI_API_KEY` — already used by the LinkedIn bot.

## Tuning volume (optional)

Create these repo **variables** (not secrets):
- `EMAIL_SEND_PER_DAY` — how many email issues per day. Default `10`, max `20`.
- `EMAIL_COMPANIES_PER_DAY` — how many companies to match emails for per day.
  Default `10`, max `20`. (The crawler tries up to 40 sites because many small
  startups publish no email at all.)

## Customize the emails

Edit `scripts/outreach/profile.md` from the GitHub web UI. It feeds Gemini your
intro, repo, and rules. Changes apply on the next run.

## What to expect (honest)

- Emails come from scraped **public** addresses (`careers@`, `hr@`, `info@`,
  `hello@`, ...) — not a verified HR database. Expect some bounces.
- At small startups, `info@`/`hello@` often lands in the founder's inbox,
  which is exactly who you want to reach.
- Replying to whoever replies is on you — the bot only prepares the first email.

## Manual run

Trigger "Email Outreach" from the Actions tab. Or locally:

```
node scripts/email/find-emails.mjs --check   # preview the picks + emails
node scripts/email/draft-email.mjs --check   # preview the drafts
node scripts/email/issue-emails.mjs --check  # preview what would be issued
```

`--check` never writes state or creates anything.
