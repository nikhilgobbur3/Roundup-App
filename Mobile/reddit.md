# Reddit — RoundUp Posts

## Post Guide

| # | Topic | Subreddit | Date | Posted |
|---|-------|-----------|------|--------|
| 1 | App Showcase | r/reactnative, r/developersIndia, r/SideProject | 2026-08-07 | ❌ |
| 2 | UI Overhaul Showcase | r/reactnative, r/developersIndia, r/SideProject | TBD | ❌ |
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

## Post 2: UI Overhaul Showcase

**Date:** TBD
**Posted:** ❌
**Subreddits:** r/reactnative, r/developersIndia, r/SideProject

### r/reactnative

**Title:** Gave my React Native fintech app a full UI overhaul — gradient hero, floating tab bar, micro-animations (Reanimated 4). Before/after inside.

**Body:**

Heads up, r/reactnative — I just redesigned **RoundUp** (a UPI expense tracker that rounds up every payment to the nearest ₹10 and saves the spare change). The goal was to make *saving* feel like a product, not a ledger.

What changed:

- **Gradient "wealth" hero** on Home — the savings number **counts up** when it loads (Reanimated `withTiming` on a shared value), has a soft pulsing glow, and parallax-scrolls behind the list (`expo-linear-gradient` + `useAnimatedScrollHandler`).
- **3 stat pills** — Roundups / saved this month / avg roundup.
- **Animated transaction rows** — colored icon circles + green "+₹" badges per row, staggered fade-in entrance.
- **Floating tab bar** — absolute rounded pill instead of the full-width strip.
- **Instant open** — the transaction store caches to AsyncStorage and Home hydrates from cache first, then refreshes in the background. Kills the blank-screen-while-backend-wakes problem.

![new home screen](media/screenshots/home.png)

Rules I followed: only animate `transform`/`opacity` (GPU-composited), one shared value per animation, staggered entrances with `withDelay`.

Repo: https://github.com/nikhilgobbur3/Roundup-App

Questions I'd love input on: **do you keep gradient cards in fintech apps or is it too "consumer"? And did you hit Reanimated 4 worklets issues in Expo Go?**

### r/developersIndia

**Title:** Redesigned my UPI expense-tracking app's UI (React Native + Reanimated) — gradient wealth card, floating tab bar, ₹ roundup badges

**Body:**

Sharing a UI overhaul of **RoundUp** — the UPI expense tracker that rounds every payment up to the nearest ₹10 and saves the spare change. Same money math (₹153 → ₹160, ₹7 saved), but the app now *feels* premium:

- Gradient savings hero that counts up + pulses on load
- 3 stat pills (roundups, saved this month, avg roundup)
- Transaction rows with green +₹ badges
- Floating rounded tab bar
- Pay/Scan/Profile/Login screens polished to match
- Home opens instantly (AsyncStorage cache, then background refresh)

![new home screen](media/screenshots/home.png)

Built with React Native + Expo SDK 54, Reanimated 4, Spring Boot backend, Railway + Neon. Repo: https://github.com/nikhilgobbur3/Roundup-App

Feedback welcome — what's the one fintech UI pattern you think is overrated?

### r/SideProject

**Title:** I redesigned my savings app's UI to make the "spare change" moment feel big — count-up hero, floating tab bar

**Body:**

**RoundUp** rounds up every UPI payment to the nearest ₹10 and moves the spare change to savings (₹153 → ₹160, ₹7 saved). The core flow worked; the design didn't match the idea. So I did a full UI pass:

- Gradient "wealth" hero that counts up and glows
- 3 quick stat pills on Home
- Animated rows with green +₹ badges
- Floating rounded tab bar
- Confetti celebration after every payment
- Instant-open caching so there's no loading blank

![new home screen](media/screenshots/home.png)

Full-stack, runs on my phone today (dummy payment mode — real Razorpay checkout built and ready behind one flag).

Repo: https://github.com/nikhilgobbur3/Roundup-App

What's your take — does a "celebration moment" actually change user behavior, or is it gimmick?

---

*Updated automatically with each session.*
