# Twitter — RoundUp Posts

## Post Guide

| # | Topic | Type | Date | Posted |
|---|-------|------|------|--------|
| 1 | App Launch Announcement | Thread | TBD | ❌ |
| 2 | Dummy Payment Mode | Thread | TBD | ❌ |
| 3 | Dummy Mode Fix — Transactions Now Recorded | Thread | TBD | ❌ |
| 4 | Celebration Screen + "Your Wealth" + Connection Fixed | Thread | TBD | ❌ |
| 5 | | | | |

---

## Post 1: Launch Announcement

**Date:** TBD

### Tweet 1
Built a UPI expense tracker called RoundUp in my free time. 🚀

Scan any UPI QR → enter amount → rounds up to nearest ₹10 → spare change saved automatically.

No manual entries. No switching apps.

### Tweet 2
Tech stack:
• React Native + Expo SDK 54
• Spring Boot 3.2.5
• PostgreSQL (Neon)
• Razorpay
• JWT auth
• Railway

Built for India's UPI ecosystem. 🇮🇳

### Tweet 3
Hardest part: PhonePe blocks external upi://pay intents. Switched to Razorpay WebView checkout instead — works in Expo Go without native builds.

Railway free tier cold start (20-30s) was another challenge. Fixed with 30s API timeout.

### Tweet 4
This is a side project — not a startup. Just solving my own problem of tracking UPI expenses and saving spare change automatically.

Code is on GitHub. Will share the link when I clean it up. 🔗

---

## Post 2: Dummy Payment Mode

**Date:** TBD

### Tweet 1
Quick update on RoundUp — added a dummy payment mode so I can test the full flow without setting up Razorpay live payments. 🔧

### Tweet 2
How it works:
Scan QR → enter amount → tap Pay → 1.5s spinner → "Payment Successful" ✅

All Razorpay code stays in place — just behind a flag. Flip one variable to go live.

### Tweet 3
Also cleaned up the Razorpay WebView config. Removed hardcoded payment method blocks. Now it shows whatever methods are enabled in the dashboard automatically.

### Tweet 4
Next step: Fix Expo Go connection over mobile hotspot. Windows firewall keeps blocking it. Anyone dealt with this before? Tips welcome. 🙏

---

## Post 3: Dummy Mode Fix — Transactions Now Recorded

**Date:** TBD

### Tweet 1
Fixed a bug in RoundUp's dummy payment mode. It was showing "Payment Successful" but never actually recording the transaction. 🐛

### Tweet 2
What was happening:
- User scans QR → enters ₹153 → taps Pay → "Success! ✅"
- Goes home → balance still ₹0, no transaction, no savings

Not very useful as a demo. 😅

### Tweet 3
Fix: Added `addTransaction()` + `fetchTransactions()` calls before the success screen.

Now the dummy mode:
1. Shows processing spinner (1.5s)
2. Records expense to backend (₹160)
3. Calculates roundup savings (+₹7)
4. Updates balance + transaction list
5. Shows success screen

### Tweet 4
Same backend API, same roundup logic — just no Razorpay checkout modal. One config flag (`DUMMY_PAYMENTS`) controls real vs dummy mode. All Razorpay code preserved.

Dummy mode now behaves identically to real mode for the user. 🚀

---

## Post 4: Celebration Screen + "Your Wealth" + Connection Fixed

**Date:** TBD

### Tweet 1
RoundUp update: every payment now ends with a celebration. 🎉 Confetti, a haptic buzz, and "+₹7 invested in savings" dropping in after you pay.

### Tweet 2
The home screen got a redesign too. Instead of balance, it shows one big number: **Your Wealth** — your savings, 52pt, bold. The psychological difference is huge.

### Tweet 3
Also finally fixed phone testing: the app now runs on my phone via Expo Go with my phone as the hotspot (Metro server runs detached so it survives my shell timeouts). No more firewall fighting. 📱

### Tweet 4
And a bug deep-dive: payments were failing with "HTTP 403" — Spring Security's default response for bad/unknown-user tokens. The app only logged you out on 401, so a stale session failed silently. Added a 401 JSON entry point + now logging out on 403 too.

Savings already show correctly end-to-end: pay ₹153 → +₹7 to wealth. 🚀

---

## Thread Template

**1/** [Hook — problem statement]
**2/** [The solution product shot]
**3/** [Tech stack code snippet or architecture]
**4/** [Key challenge + how you fixed it]
**5/** [Call to action — GitHub link, follow, etc.]

---

*Updated automatically with each session.*
