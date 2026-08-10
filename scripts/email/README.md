# Cold Email Outreach Assistant

Sends personalized cold emails to small YC startups (India first, then remote)
whose HR/contact addresses are **publicly published** on their websites. It runs
fully automatically — finds the emails, drafts each message with Gemini, and
sends through a **separate Brevo account** so your personal Gmail is never used
(Google bans automated cold outreach from personal Gmail).

## Flow (runs automatically every day at 08:00 IST, after the LinkedIn batch)

1. `find-emails.mjs` — picks companies we haven't emailed yet, crawls their
   website (homepage + /careers + /contact + /about) for public contact emails,
   and saves the batch to `pack.json`.
2. `draft-email.mjs` — Gemini writes a short, genuine, first-person email per
   company (subject + body) using `scripts/outreach/profile.md`.
3. `send-email.mjs` — sends up to **10/day (max 20)** through the Brevo REST
   API, marks recipients as sent in `state.json` so nobody gets emailed twice,
   and leaves the rest for the next run.
4. The workflow commits the updated state.

## One-time setup (5 minutes, free)

1. Sign up at **https://www.brevo.com** (free plan, 300 emails/day, no card).
2. In Brevo: **Settings → Senders & IPs → Sender Addresses → Add a sender**.
   Verify a new address — do **not** use your personal Gmail. Any plain email
   works (e.g. `hello@yourname.something`); verifying a real domain (DKIM/SPF)
   improves deliverability a lot.
3. Grab your **API key**: Brevo **Settings → API Keys → Generate**.
4. Add these repo **secrets** (Settings → Secrets and variables → Actions):
   - `BREVO_API_KEY` — the key from step 3
   - `EMAIL_FROM_ADDRESS` — the verified sender address from step 2
   - `EMAIL_FROM_NAME` — your name as shown on the email, e.g. `Nikhil G`
5. `GEMINI_API_KEY` is already used by the LinkedIn bot — no need to add it
   again.

## Tuning volume (optional)

Create these repo **variables** (not secrets):
- `EMAIL_SEND_PER_DAY` — how many emails per day. Default `10`, max `20`.
- `EMAIL_COMPANIES_PER_DAY` — how many companies to match emails for per day.
  Default `10`, max `20`. (The crawler tries up to 40 sites because many small
  startups publish no email at all.)

Start at 10/day. A brand-new sender address has no reputation, so early emails
may land in spam; it improves with steady volume. Raise the cap only after a
couple of weeks.

## Customize the emails

Edit `scripts/outreach/profile.md` from the GitHub web UI. It feeds Gemini your
intro, repo, and rules. Changes apply on the next run.

## What to expect (honest)

- Emails come from scraped **public** addresses (`careers@`, `hr@`, `info@`,
  `hello@`, ...) — not a verified HR database. Expect some bounces.
- At small startups, `info@`/`hello@` often lands in the founder's inbox,
  which is exactly who you want to reach.
- Replying to whoever replies is on you — the bot only sends the first email.

## Manual run

Trigger "Email Outreach" from the Actions tab. Or locally:

```
node scripts/email/find-emails.mjs --check   # preview the picks + emails
node scripts/email/draft-email.mjs --check   # preview the drafts
node scripts/email/send-email.mjs --check    # preview what would be sent
```

`--check` never writes state or sends anything.
