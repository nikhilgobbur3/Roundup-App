# Hashnode — RoundUp Blog Posts

## Post Guide

| # | Topic | Type | Date | Posted |
|---|-------|------|------|--------|
| 1 | Building RoundUp — full-stack UPI app | Article | 2026-08-07 | ❌ |
| 2 | Auth deep-dive: the 401-vs-403 trap | Article | TBD | ❌ |
| 3 | The design overhaul — making saving feel like a product | Article | TBD | ❌ |
| 3 | | | | |

> **How auto-posting works:** the GitHub Action posts this article when `**Date:**` is set (not TBD) and `**Posted:**` is `❌`. After posting it flips to `✅`.

---

## Post 1: Building RoundUp — A UPI Expense Tracker That Saves Your Spare Change

**Date:** 2026-08-07
**Posted:** ❌
**Tags:** reactnative, expo, springboot, fintech, upi

**Title:** Building RoundUp — A Full-Stack UPI App That Saves Your Spare Change (React Native + Spring Boot)

**Body:**

### Executive Summary (for non-technical readers)

Every time I paid via UPI, small expenses vanished into my bank statement and I had no idea where my money went. So I built **RoundUp** — an app that logs every payment and automatically saves your spare change. A ₹350 coffee becomes ₹360, and ₹10 quietly moves into savings.

I built the whole thing end-to-end myself: the mobile app, the backend, the database, the payment integration, and the design. It runs on a real phone today. The part I'm proudest of isn't the tech — it's the thinking behind it. Every payment ends in a small celebration (confetti, a haptic buzz, "₹7 invested"), and the home screen shows one big "Your Wealth" number instead of a balance. Because small, repeated wins are what build habits — and habits are what make a product work.

This article covers the architecture and every hard problem I hit, written so engineers can dig deep and everyone else can follow the story.

> **Canonical:** this article is also published on Dev.to — [link](https://dev.to/nikhilgobbur3). This is the canonical version on Hashnode.

### The Problem

UPI changed how India pays. It made payments effortless — which is exactly why nobody tracks them anymore. There's no friction, no receipt, no moment of "wait, that was how much?" My savings were the casualty. I didn't need another expense tracker that demands manual entries (nobody keeps those up). I needed one that worked in the background and made saving feel rewarding instead of painful.

### The Product

RoundUp does two things:

1. **Logs every UPI payment automatically.** Scan any UPI QR code, enter the amount you paid, and it's recorded. No manual entries, no switching between apps.
2. **Rounds up and saves the spare change.** A ₹153 payment becomes ₹160 — the extra ₹7 goes straight into savings, shown in real time.

The design is the feature:

- **"Your Wealth" hero** — the home screen shows savings in huge type, not balance and not expenses. Framing money as wealth changes how you spend it.
- **Celebration screen** — every payment ends with confetti, a haptic buzz, and "₹7 invested in savings." A tiny win each time = a habit that sticks.

![Celebration screen confetti engine](media/code/celebration-screen.png)

### How It Works (plain English)

```
Scan QR → enter ₹153 → "You'll pay ₹160" preview → tap Pay →
1.5s spinner → confetti + "₹7 invested in savings" → home screen updates
```

The app talks to a backend (a separate computer running the business logic) that stores users, balances, and transactions, and securely handles login. Payments are integrated with Razorpay — a real payment provider. Right now the app is in **dummy payment mode** for testing: it exercises the exact same flow and records real transactions to the backend, but skips the actual money transfer. One config flag flips on the full Razorpay checkout — all the code is in place.

![The roundup math, server-side](media/code/roundup-math.png)

### The Architecture

- **Frontend:** React Native + Expo SDK 54, Expo Router (file-based routing), Reanimated, Gesture Handler, Zustand (client state) + React Query (server state), expo-secure-store (tokens)
- **Backend:** Spring Boot 3.2.5 (Java 17) REST API with JWT auth (jjwt), Spring Security
- **Database:** PostgreSQL on Neon
- **Payments:** Razorpay (WebView checkout, works in Expo Go without native builds)
- **Hosting:** Railway (backend) + Neon (database)

### The Hard Problems (and What They Taught Me)

**1. Payments: UPI deep links are blocked.** I started with `upi://pay` intents to hand off to UPI apps. PhonePe and GPay block payments initiated from third-party apps. I switched to a Razorpay WebView checkout — which also sidesteps Expo Go's limitation on native modules. *Lesson: the platform you planned around may not let you in; design for the fallback early.*

**2. The roundup showed ₹0 — a money math bug.** The app was sending the *rounded total* (₹160) to the backend instead of the *original bill* (₹153). The server computes the roundup with `ceil(amount/10)*10 - amount`, so it was rounding a round number and getting ₹0. The fix: always send the original amount. *Lesson: a bug that fails silently and quietly corrupts money data is the worst kind — add the check where the math happens, not where it's displayed.*

**3. "Payment failed: HTTP 403" — a silent auth failure.** Spring Security returns **403** by default for bad or unknown-user tokens; my app only cleared its session on **401**. So when a token expired, the user was still "logged in" and every payment failed silently. Fix: a proper 401 JSON `AuthenticationEntryPoint` plus clearing the session on both 401 and 403. *Lesson: know your framework's default failure modes — the bug was my assumption that a rejected token looks one way.*

![JWT SecurityConfig](media/code/security-config.png)

**4. Railway cold start.** The free tier sleeps after idle, so the first request after a pause took 20–30s. Fixed with a 30s client timeout and treating it as a design constraint.

### What I Learned About Shipping

- **Own the whole stack.** Building frontend + backend + deployment means no "it works on my machine" excuses — when something breaks, it's yours, and fixing it is fast.
- **Speed matters as much as correctness.** I shipped a working, testable flow (dummy payments) before wiring the real payment gateway. That let me validate the product while keeping the real integration ready behind one flag.
- **User psychology is engineering.** The most "technical" thing in this app is the choice to show one big "Your Wealth" number. Products are won in those decisions.
- **Design for the demo.** The celebration screen isn't decoration — it's a retention strategy, and it's what makes the app fun to show people.

### What's Next

- Real payments (flip `DUMMY_PAYMENTS` to `false` — the Razorpay checkout is already built)
- Savings streaks and a goal progress ring
- Dark mode
- Notifications (working in the APK; blocked in Expo Go on SDK 54)

**Repo:** https://github.com/nikhilgobbur3/Roundup-App

If you're building something similar — or have a take on the product decisions — I'd genuinely love to hear it. What would you have built differently?

---

## Post 2: Auth Deep-Dive — Spring Security's 401-vs-403 Trap

**Date:** TBD
**Posted:** ❌
**Tags:** springboot, security, jwt, java

**Title:** Spring Security Returned 403 for a Bad JWT and My App Failed Silently — Here's the Fix

**Body:**

[To be written — covers the AuthenticationEntryPoint fix, why 403 vs 401, and session clearing on both statuses.]

---

## Post 3: The Design Overhaul — Making Saving Feel Like a Product

**Date:** TBD
**Posted:** ❌
**Tags:** reactnative, expo, reanimated, fintech, uiux

**Title:** I Redesigned My Fintech App's UI — Gradients, Micro-Animations, and a Floating Tab Bar (React Native + Reanimated)

**Body:**

### Executive Summary

I shipped a full visual overhaul of **RoundUp**, my UPI expense-tracking app, and the goal was simple: make saving feel like a product, not a ledger. The home screen now opens with a gradient "wealth" card that counts up, three stat pills, and an activity list where every row shows the spare change it saved. Payments end in confetti. The tab bar floats. And the app now opens instantly because it renders from a local cache first.

A ₹153 payment still becomes ₹160 — ₹7 quietly saved. But now the app *feels* like the ₹7 matters.

![RoundUp new home screen](media/screenshots/home.png)

### What Changed

- **Gradient "wealth" hero** — the savings number counts up when it appears, has a soft pulsing glow, and parallax-scrolls behind the list. Built with `expo-linear-gradient` + Reanimated.
- **3 stat pills** — Roundups (count), saved this month (₹), and avg roundup (₹). Instant context without opening anything.
- **Animated transaction rows** — each row has an icon in a colored circle and a green "+₹" badge showing exactly what it saved you.
- **Floating tab bar** — a rounded pill instead of a full-width strip; it looks native to the glassy fintech style.
- **Pay/Scan/Profile/Auth polish** — gradient merchant card + ₹-prefixed amount input + animated roundup pill on Pay; rounded camera frame with an animated scan line; gradient avatar + grouped cards on Profile; gradient brand tiles on Login/Signup.
- **Instant open** — the transaction store caches its last fetch to AsyncStorage, so Home renders immediately and refreshes in the background. No more blank screen while Railway's free tier wakes up.

![RoundUp pay screen with roundup pill](media/screenshots/pay.png)

### The Animation Rules I Followed

1. **Only animate `transform` and `opacity`** — everything stays GPU-composited, no layout thrash.
2. **Count-up with `withTiming`** on a shared value, rendered through a run-on-JS-UI hook — the number eases instead of jumping.
3. **Staggered entrances** — hero first, then pills, then rows fade up in sequence. Feels choreographed, not chaotic.

### What I'd Do Differently

Dark mode and a savings-goal progress ring are next. The patterns are all in place — it's just tokens and data at this point.

**Repo:** https://github.com/nikhilgobbur3/Roundup-App

If you've designed a fintech UI — what's the one detail that made the biggest difference for your users?

---

*Updated automatically with each session.*
