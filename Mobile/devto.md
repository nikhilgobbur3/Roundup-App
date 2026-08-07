# Dev.to — RoundUp Blog Posts

## Post Guide

| # | Topic | Type | Date | Posted |
|---|-------|------|------|--------|
| 1 | App Walkthrough | Article | TBD | ❌ |
| 2 | | | | |
| 3 | | | | |

---

## Post 1: Building a UPI Expense Tracker with React Native & Spring Boot

**Date:** TBD
**Tags:** reactnative, expo, springboot, fintech, upi

### Draft

**Title:** Building RoundUp — A UPI Expense Tracker That Saves Your Spare Change

**Intro:**
Every time I pay via UPI, I lose track of my expenses. I wanted a simple app that logs each payment automatically and rounds up the spare change to savings. So I built RoundUp.

**What it does:**
- Scan any UPI QR code
- Enter the amount you paid
- RoundUp rounds it to the nearest ₹10
- The spare change goes to savings
- All in one tap — no UPI app switching

**Tech Stack:**
- Frontend: React Native + Expo SDK 54 (Expo Router, Reanimated 4, Gesture Handler)
- Backend: Spring Boot 3.2.5 (Java 17)
- Database: PostgreSQL (Neon)
- Payments: Razorpay (test mode)
- Auth: JWT (jjwt 0.12.5)
- State: Zustand + React Query
- Hosting: Railway (backend) + Neon (database)

**Key Challenges:**
1. PhonePe blocks external `upi://pay` intents — switched to Razorpay WebView checkout
2. Railway free tier cold start (20-30s) — increased API timeout to 30s
3. Expo Go doesn't support native modules — used WebView-based Razorpay checkout
4. Roundup always showed ₹0 savings — mobile was sending the rounded total (₹160) instead of the original bill (₹153); the backend roundup math (`ceil(x/10)*10 - x`) needs the original amount
5. "Payment failed HTTP 403" — Spring Security returns 403 for bad/unknown-user tokens; the app only cleared its session on 401, so stale sessions failed silently. Added a 401 JSON entry point + logout on 403
6. UPI option not showing in Razorpay checkout — requires dashboard configuration

**Current State:**
The app runs live on my phone (Expo Go, phone is the hotspot). **Dummy payment mode** is active: `DUMMY_PAYMENTS = true` skips Razorpay and records the transaction directly via the backend API after a 1.5s spinner — roundup savings and transaction history update correctly. Every payment ends with a **celebration screen** (confetti + haptics + "+₹7 invested in savings"), and the home screen shows a single "Your Wealth" hero with savings in huge type. When ready for real payments, one flag flips on the full Razorpay checkout (order creation → WebView checkout → signature verification) — all the code is already in place.

**Architecture:**
- Frontend: React Native + Expo SDK 54 with Expo Router (file-based routing)
- Backend: Spring Boot 3.2.5 REST API with JWT auth
- Payment flow: User scans QR → enters amount → tap Pay (exact bill) → 1.5s spinner → celebration (dummy) OR Razorpay checkout → verify → celebration (live)
- State: Zustand for client state, React Query for server state
- Storage: expo-secure-store for tokens, AsyncStorage for settings

**Repository:**
[GitHub link]

---

*Updated automatically with each session.*
