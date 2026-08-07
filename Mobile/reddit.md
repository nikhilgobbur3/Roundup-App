# Reddit — RoundUp Posts

## Post Guide

| # | Topic | Subreddit | Date | Posted |
|---|-------|-----------|------|--------|
| 1 | App Showcase | r/reactnative, r/developersIndia, r/SideProject | 2026-08-07 | ❌ |
| 2 | | | | |

> **How auto-posting works:** the GitHub Action posts each subreddit draft below when `**Date:**` is set (not TBD) and `**Posted:**` is `❌`. After posting it flips to `✅`.

---

## Post 1: App Showcase

**Date:** 2026-08-07
**Posted:** ❌
**Subreddits:** r/reactnative, r/developersIndia, r/SideProject

### r/reactnative

**Title:** Built a UPI expense tracker with React Native + Expo — full-stack, running on my phone. Here's what I learned.

**Body:**

Hey everyone — sharing **RoundUp**, a UPI expense tracker that rounds up every payment to the nearest ₹10 and puts the spare change into savings.

The stack: React Native + Expo SDK 54 (Expo Router, Reanimated, Gesture Handler), Zustand + React Query, expo-secure-store. Spring Boot 3.2.5 backend, PostgreSQL (Neon), Razorpay payments, Railway hosting.

The part I'm proudest of: I wanted it to feel like a product, not a demo. Every payment ends with a celebration (confetti + haptic buzz) and the home screen shows one big "Your Wealth" number. Small wins, consistently = habit formation. That's the whole thesis.

Hardest bugs I hit:

1. **Roundup always showed ₹0** — I was sending the rounded total (₹160) to the backend instead of the original bill (₹153). The server does the roundup math (`ceil(amount/10)*10 - amount`) and needs the original amount.
2. **"Payment failed: HTTP 403"** — Spring Security returns 403 for bad/unknown-user tokens by default; my app only cleared its session on 401, so stale sessions failed silently. Fix: 401 JSON `AuthenticationEntryPoint` + logout on both statuses.
3. **PhonePe blocks external `upi://pay` intents** — switched to a Razorpay WebView checkout (works in Expo Go, no native modules needed).

![roundup math](media/code/roundup-math.png)

Repo: https://github.com/nikhilgobbur3/Roundup-App

Would love your feedback on the architecture or the UX. And genuinely curious: **what would you have built differently?**

### r/developersIndia

**Title:** Built a UPI expense tracker for India — React Native + Spring Boot, full-stack

**Body:**

Built **RoundUp** — a UPI expense tracker that rounds up every payment to the nearest ₹10 and auto-saves the spare change. Very India-specific: UPI is everywhere, expense tracking is nowhere.

Stack: React Native + Expo SDK 54, Spring Boot 3.2.5, PostgreSQL (Neon), Razorpay, Railway.

Highlights and pain points:

- PhonePe/GPay block external `upi://pay` intents → Razorpay WebView checkout instead
- Railway free tier cold start (20–30s) → 30s API timeout in the client
- Roundup showed ₹0 because I sent the rounded total (₹160) instead of the original bill (₹153) — the server needs the original amount to compute the roundup
- Auth trap: Spring Security returns 403 for bad/unknown-user tokens, but my app only logged out on 401 → silent failures. Fix: 401 JSON `AuthenticationEntryPoint` + clear session on both statuses

The product angle: celebration screen after every payment, "Your Wealth" hero on home. Money psychology, productized. Runs live on my phone.

Repo: https://github.com/nikhilgobbur3/Roundup-App

Feedback welcome — **what would you have built differently?**

### r/SideProject

**Title:** I built an app that saves your spare change on every UPI payment — without you noticing

**Body:**

Every UPI payment is a tiny leak in your savings that you never track. **RoundUp** logs every payment automatically, rounds up to the nearest ₹10, and the spare change goes to savings.

- Scan any UPI QR → enter amount → done
- ₹153 payment → you pay ₹160, ₹7 quietly moves to savings
- Home screen shows one big "Your Wealth" number, not a balance

Built it full-stack myself: React Native + Expo, Spring Boot, PostgreSQL, Razorpay. Running on my phone today (dummy payment mode for testing — real checkout is built and ready behind one flag).

The part I'm proudest of: design decisions that create a habit. Every payment ends in a celebration. Small wins, repeated = the product works.

Repo: https://github.com/nikhilgobbur3/Roundup-App

What would you have built differently? Feedback welcome.

---

*Updated automatically with each session.*
