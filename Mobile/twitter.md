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
Most people don't save because saving never happens automatically. So I built RoundUp — a UPI expense tracker that saves your spare change for you. 🚀

### Tweet 2
Scan any UPI QR code (or type a UPI ID) → enter the amount → every payment rounds up to the nearest ₹10. A ₹153 payment becomes ₹160. The ₹7 goes straight to savings.

No manual entries. No switching apps.

### Tweet 3
Built end-to-end by me: React Native + Expo app, Spring Boot backend, PostgreSQL, Razorpay for payments, hosted on Railway. Real product, real payment flow — live checkout is built and ready behind one flag.

### Tweet 4
Hardest part was payments: PhonePe blocks external UPI intents, so I switched to Razorpay's WebView checkout. Also killed the Railway cold-start problem with a 30s API timeout.

### Tweet 5
Why I built it: I'm a full-stack engineer who thinks in products. I wanted to take an idea from QR scan to money actually saved — and ship it publicly.

Code is live on GitHub: https://github.com/nikhilgobbur3/Roundup-App

What's the one habit you'd automate if you could? 👇

---

## Post 2: Dummy Payment Mode

**Date:** TBD

### Tweet 1
RoundUp update: I built a dummy payment mode so the entire flow works end-to-end for testing — without touching live money. 🔧

### Tweet 2
How it works: scan QR → enter amount → tap Pay → 1.5s spinner → "Payment Successful" ✅

Same backend, same roundup math, same celebration. No real charge — perfect for demos and safe for tests.

### Tweet 3
The real Razorpay checkout is fully built and waiting behind one config flag. Flip it and real payments switch on. Dummy mode keeps shipping fast without risking a single rupee.

### Tweet 4
Also cleaned up the Razorpay WebView config. Payment methods now auto-load from the dashboard instead of being hardcoded. Less code, fewer surprises.

### Tweet 5
Next up: shipping to my phone over Expo Go on a mobile hotspot. Windows firewall, I'm coming for you. Anyone dealt with this? Tips welcome. 🙏

---

## Post 3: Dummy Mode Fix — Transactions Now Recorded

**Date:** TBD

### Tweet 1
Found a money bug in RoundUp and fixed it. The math looked right on screen, but the backend was getting the wrong number. 🐛

### Tweet 2
What was happening: I sent the ROUNDED total (₹160) to the backend instead of the ORIGINAL bill (₹153). So the server ran the roundup math on ₹160 → ₹0 saved.

Paying more, saving nothing. Not the point of the app. 😅

### Tweet 3
The fix: send the original amount. Now it works end-to-end:

Expense ₹153 → roundup +₹7 → total ₹160. Savings actually land.

### Tweet 4
This is exactly why you test payments in dummy mode before going live — same backend, same logic, real bugs, zero real money at stake.

### Tweet 5
RoundUp now: pays the exact bill (₹153), rounds up (+₹7), and updates "Your Wealth" in real time. One config flag (`DUMMY_PAYMENTS`) flips over to the real Razorpay checkout. 🚀

---

## Post 4: Celebration Screen + "Your Wealth" + Connection Fixed

**Date:** TBD

### Tweet 1
RoundUp update: every payment now ends with a celebration. 🎉 Confetti, a haptic buzz, and "+₹7 invested in savings" dropping in the moment you pay.

### Tweet 2
Why? Psychology. ₹7 of savings feels like nothing — until the app makes a moment of it. Small wins are what build real habits.

### Tweet 3
The home screen got a redesign too. No balance front and center — just ONE number: **Your Wealth**. 52pt, bold. The number you actually want to see grow.

### Tweet 4
Also finally fixed phone testing: the app now runs on my phone via Expo Go with my phone as the hotspot. Metro server runs detached, so it survives my shell timeouts. No more firewall fighting. 📱

### Tweet 5
And a backend deep-dive: payments were failing with "HTTP 403" — Spring Security's default response for bad/unknown-user tokens, but the app only logged out on 401. Added a 401 JSON entry point and now handle 403 too.

Result: pay ₹153 → +₹7 to wealth, end to end. 🚀

---

## Thread Template

**1/** [Hook — problem statement]
**2/** [The solution product shot]
**3/** [Tech stack code snippet or architecture]
**4/** [Key challenge + how you fixed it]
**5/** [Call to action — GitHub link, follow, etc.]

---

*Updated automatically with each session.*
