# Reddit — RoundUp Posts

## Post Guide

| # | Topic | Subreddit | Date | Posted |
|---|-------|-----------|------|--------|
| 1 | App Showcase | r/reactnative, r/developersIndia | TBD | ❌ |
| 2 | | | | |
| 3 | | | | |

---

## Post 1: App Showcase

**Date:** TBD
**Subreddits:** r/reactnative, r/developersIndia, r/SideProject

### Title Options
- "Built a UPI expense tracker with React Native + Spring Boot — feedback welcome!"
- "I built a tiny app that rounds up my UPI expenses to the nearest ₹10"

### Post Body (r/reactnative)

**Title:** Built a UPI expense tracker with React Native + Expo — here's my experience

**Content:**

Hey everyone,

Built a side project called RoundUp — a UPI expense tracker that rounds up every payment to the nearest ₹10 and saves the spare change.

**Stack:**
- React Native + Expo SDK 54
- Expo Router (file-based routing)
- Spring Boot 3.2.5 backend
- PostgreSQL (Neon)
- Razorpay for payments
- Zustand + React Query for state

**What I learned:**

1. **PhonePe blocks `upi://pay` intents** — Had to switch from UPI deep links to Razorpay WebView checkout. PhonePe intentionally blocks payments initiated from third-party apps for security.

2. **Railway free tier cold start is painful** — 20-30s delay on first request after idle. Fixed by setting API timeout to 30s in the fetch client.

3. **Expo Go is great but limiting** — Can't use native modules. Went with WebView-based Razorpay checkout instead of the native SDK. Works in both Expo Go and production APK.

4. **expo-notifications crashes Expo Go on SDK 54** — Known issue. Notifications work in APK but not in Expo Go past SDK 53. Had to remove notification code from Expo Go builds.

**Current state:** App runs live on my phone (Expo Go — my phone is the hotspot, Metro server runs detached so it survives shell timeouts). Dummy payment mode is active for testing (1.5s spinner → transaction recorded to backend → celebration screen). Each payment ends with confetti + haptics and "+₹7 invested in savings"; the home screen shows a single "Your Wealth" hero with savings in huge type. All Razorpay code preserved behind one flag (`DUMMY_PAYMENTS`); flipping it activates the full Razorpay checkout.

**What I'd change / am stuck on:**
- The 401-vs-403 auth trap — Spring Security returns 403 by default for bad/unknown-user tokens, and my app only cleared its session on 401. A stale token for a user who no longer existed in the DB (Railway reset) failed silently with ₹0. Fix: 401 JSON `AuthenticationEntryPoint` + clear session on both statuses. (Backend change waiting on a Railway redeploy.)
- Another sneaky bug — roundup always showed ₹0 because I was sending the rounded total (₹160) to the backend instead of the original bill (₹153). The server does the roundup math; it needs the original amount.
- Razorpay dashboard UPI toggle — need to enable it for UPI to show in checkout
- EAS free tier build minutes exhausted — need to wait for monthly reset or upgrade

**Repo:** [GitHub link — coming soon]

Would love feedback on the architecture, code structure, or UX. Thanks!

---

### Post Body (r/developersIndia)

**Title:** Built a UPI expense tracker for India — React Native + Spring Boot

**Content:**

[Same as above, but emphasize India-specific challenges]

**India-specific notes:**
- UPI integration required
- PhonePe/GPay deep link limitations
- Currency: ₹ INR, rounds to nearest ₹10
- Railway free tier for hosting (cheap but cold start)
- Neon PostgreSQL for database

---

### Post Body (r/SideProject)

**Title:** I built an app that rounds up my UPI expenses automatically

**Content:**

[Shorter version — focus on the problem/solution, less technical detail]

---

*Updated automatically with each session.*
