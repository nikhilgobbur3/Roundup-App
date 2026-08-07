# Hashnode — RoundUp Blog Posts

## Post Guide

| # | Topic | Type | Date | Posted |
|---|-------|------|------|--------|
| 1 | App Walkthrough | Article | TBD | ❌ |
| 2 | | | | |
| 3 | | | | |

---

## Post 1: Building a UPI Expense Tracker with React Native & Spring Boot

**Date:** TBD
**Tags:** reactnative, expo, springboot, fintech, upi, india

### Draft

**Title:** Building RoundUp — A UPI Expense Tracker That Saves Your Spare Change

**Canonical URL:** `https://dev.to/[username]/building-roundup` (link to Dev.to article as canonical)

**Content:**
Same article structure as Dev.to post, adapted for Hashnode's editor:

- Use Hashnode's built-in code blocks with syntax highlighting
- Add cover image (app screenshot or logo)
- Use callout boxes for tips/warnings
- End with a question to engage comments

**Notes for adaptation:**
- Hashnode supports richer embeds — add a video demo if available
- Hashnode's audience skews slightly more professional/enterprise
- Emphasize the Spring Boot architecture and production deployment decisions
- Include the config flag pattern (`DUMMY_PAYMENTS`) as a clean pattern for feature gating
- Mention that dummy mode records real transactions to backend — roundup savings and history all update
- Highlight the **celebration screen** (confetti + haptics via `expo-haptics` + `expo-linear-gradient`) and the **"Your Wealth" hero** — savings-first psychology as a retention/behavioral-design case study
- Worth a section on the 401-vs-403 auth pitfall: Spring Security returns 403 by default for bad tokens unless you add an `AuthenticationEntryPoint` — and the app must clear its session on both statuses

---

## Post 2: [Next Topic]

**Date:** TBD
**Tags:** 

### Draft
[To be written when feature ships]

---

*Updated automatically with each session.*
