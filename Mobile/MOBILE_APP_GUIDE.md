# RoundUp Mobile App — Beginner's Guide

> **No coding experience needed.** This explains how the app works, what each piece does, and how they all fit together — like explaining a car engine with a picture book.

---

## 1. What Is This App?

**RoundUp** is a banking app that "rounds up" your spare change.

Example: If you buy coffee for ₹350, the app rounds up to ₹360 and saves the extra ₹10 automatically. Over time, those pennies grow into real savings.

The app is fully built: login/signup, QR scan, payment flow, and the automatic "round up to savings" feature all work end-to-end.

---

## 2. The Analogy: A Restaurant

| Restaurant | RoundUp App | What it does |
|---|---|---|
| 🏪 The whole restaurant | **The app** (mobile + backend) | Everything together |
| 🍳 Kitchen | **Backend (Spring Boot + PostgreSQL)** | Cooks food, stores ingredients (your data) |
| 🧾 Menu | **types/index.ts** | Lists what dishes exist (User, Login, Signup) |
| 🧑‍🍳 Chef | **AuthController + AuthService** (Java) | Processes orders, checks passwords, creates JWT |
| 🗄️ Pantry | **PostgreSQL database** | Stores all ingredients (users, balances) |
| 🧑‍💼 Manager | **Zustand Store** | Remembers who you are across the whole app |
| 🧑‍🍳 Waiters | **API Client** | Carries orders between you (screen) and kitchen (backend) |
| 🪑 Tables | **Screens** (login.tsx, home.tsx, profile.tsx) | Where you sit and interact |
| 🔑 Keycard | **JWT Token** | Proves who you are — kitchen checks before serving you |
| 🗃️ Locker | **SecureStore** | Keeps your keycard safe even when you leave |
| 📋 Order Form | **React Hook Form + Zod** | Makes sure your order is correct before sending |
| 🪧 Signage | **Expo Router** | Shows you where to go (Login → Home → Profile) |
| 🎨 Decor | **constants/** (colors, spacing, fonts) | The paint, spacing, and font choices that make it look good |

---

## 3. The Folder Structure (What Lives Where)

```
Mobile/
├── app/                    ← The SCREENS (what you see on your phone)
│   ├── _layout.tsx         ← THE ROOT — wraps everything, checks if you're logged in
│   ├── index.tsx           ← THE GATE — if logged in → Home; if not → Login
│   ├── (auth)/             ← LOGIN/SIGNUP screens (no tabs shown here)
│   │   ├── _layout.tsx     ← Auth screen header (back button, title)
│   │   ├── login.tsx       ← Sign In form
│   │   └── signup.tsx      ← Create Account form
│   └── (tabs)/             ← MAIN APP screens (bottom tab bar visible)
│       ├── _layout.tsx     ← Tab bar setup (Home + Profile tabs at bottom)
│       ├── home.tsx        ← Home screen (balance card, activity list)
│       └── profile.tsx     ← Profile screen (your info, settings, log out)
│
├── services/               ← The WAITERS (talk to the backend)
│   ├── api/
│   │   └── client.ts       ← Sends fetch requests to backend (login, signup, etc.)
│   └── storage/
│       └── secure-store.ts ← Saves/reads/deletes the JWT token on your phone
│
├── stores/
│   └── auth-store.ts       ← THE MANAGER — remembers "who is logged in" across screens
│
├── types/
│   └── index.ts            ← THE MENU — defines what User, Login, Signup look like
│
├── constants/              ← THE DESIGN RULEBOOK
│   ├── colors.ts           ← All colors (blue=primary, green=secondary, etc.)
│   ├── spacing.ts          ← All spacing sizes (4px, 8px, 16px, etc.)
│   └── typography.ts       ← All font sizes and weights
│
├── app.json                ← Expo config (app name, Android/iOS settings)
├── package.json            ← List of all ingredients (libraries) used
├── .env                    ← Secret address: "backend lives at https://roundup-app-production.up.railway.app"
└── tsconfig.json           ← TypeScript settings (makes code less error-prone)
```

---

## 4. The Complete App Flow (Step by Step)

### Journey 1: App Opens (First Time — No Account)

```
App starts
    │
    ▼
app/_layout.tsx
    │  Wraps app with GestureHandler + ReactQuery
    │  Runs AuthGate (checks if token exists on phone)
    │
    ▼
AuthGate runs
    │  Calls getToken() from secure-store.ts
    │  No token found (first time)
    │
    ▼
clearAuth() → user = null, token = null, isLoading = false
    │
    ▼
app/index.tsx (The Gate)
    │  Sees: user = null
    │  Says: "Go sign in!"
    │
    ▼
(auth)/login.tsx ← YOU ARE HERE
    │  Shows: "Welcome back — Sign in to your RoundUp account"
    │  Shows: Email input, Password input, Sign In button
    │  Shows: "Don't have an account? Sign Up" link
```

### Journey 2: First-Time Signup

```
You're on login.tsx
    │  Tap "Sign Up" link
    │
    ▼
(auth)/signup.tsx
    │  Shows: Name, Email, Password, Confirm Password
    │
    ▼
You fill in:
    │  Name: "John"
    │  Email: "john@email.com"
    │  Password: "MyPassword1"
    │  Confirm: "MyPassword1"
    │  Tap "Create Account" button
    │
    ▼
React Hook Form + Zod CHECK:
    │  ✓ Name > 2 characters?
    │  ✓ Email looks like an email?
    │  ✓ Password >= 8 chars, has 1 uppercase, has 1 number?
    │  ✓ Password == Confirm Password?
    │
    ▼  ❌ If any fail → Show error message under the field
    ▼  ✅ All pass → Continue
    │
    ▼
API Client sends POST to:
    │  https://roundup-app-production.up.railway.app/api/auth/signup
    │  Body: { name: "John", email: "john@email.com", password: "MyPassword1" }
    │
    ▼
Backend checks:
    │  Is email already used? → If yes → "Email already registered"
    │  Otherwise → Save user to database
    │  Create JWT token (a special encrypted ticket)
    │  Send back: { token: "xxx.yyy.zzz", userId: 1, name: "John", email: "john@email.com" }
    │
    ▼
App receives response:
    │  1. saveToken(token) → SecureStore saves it (like putting keycard in locker)
    │  2. setAuth(user, token) → Zustand Store remembers: user = John, token = xxx
    │  3. router.replace("/(tabs)/home") → Jump to Home screen
    │
    ▼
(tabs)/home.tsx ← YOU ARE HERE
    │  Reads user from Zustand Store
    │  Shows: "Hello, John"
    │  Shows: "Your Wealth" savings card (₹0.00 — no transactions yet)
    │  Shows: Bottom tab bar [Home] [Profile]
```

### Journey 3: Returning User (App Opens — Already Has Account)

```
App starts
    │
    ▼
AuthGate runs
    │  Calls getToken() from secure-store.ts
    │  Finds token! (Saved from last session)
    │
    ▼
API Client sends GET to:
    │  https://roundup-app-production.up.railway.app/api/auth/me
    │  Header: Authorization: Bearer xxx.yyy.zzz
    │
    ▼
Backend verifies token:
    │  Token valid? → Send back user info
    │  Token expired/invalid? → Return error
    │
    ▼  ❌ Token bad → clearAuth() → Go to Login screen
    ▼  ✅ Token good → setAuth(user, token) → Continue
    │
    ▼
app/index.tsx (The Gate)
    │  Sees: user = John
    │  Says: "Go to Home!"
    │
    ▼
(tabs)/home.tsx ← Auto-logged in! No typing needed
```

### Journey 4: Logout

```
You're on (tabs)/profile.tsx
    │  You see: avatar, name, email, settings rows
    │  You see: "Sign Out" button
    │  Tap "Sign Out"
    │
    ▼
Alert pops up: "Are you sure you want to sign out?"
    │  "Cancel" → do nothing
    │  "Sign Out" → continue
    │
    ▼
    1. clearToken() → Deletes JWT from SecureStore (throws away keycard)
    2. clearAuth() → Zustand Store forgets: user = null, token = null
    3. router.replace("/(auth)/login") → Go back to Login screen
```

---

## 5. What Each File Does (One Sentence Each)

### Screens (`app/`)

| File | One-sentence job |
|---|---|
| `_layout.tsx` | **Root wrapper** — sets up gesture support, React Query, and runs AuthGate (checks if already logged in) |
| `index.tsx` | **The gate** — if logged in → go Home; if not → go Login |
| `(auth)/_layout.tsx` | **Auth screen wrapper** — adds a header bar with back button |
| `login.tsx` | **Sign In page** — email + password form, sends to backend, on success → saves token → goes Home |
| `signup.tsx` | **Create Account page** — name + email + password + confirm, validates rules, sends to backend |
| `(tabs)/_layout.tsx` | **Bottom tab bar** — puts [Home] and [Profile] tabs at the bottom of the screen |
| `home.tsx` | **Home dashboard** — shows "Hello [name]", the "Your Wealth" savings hero, QR button (scan-to-pay), and the activity list |
| `profile.tsx` | **Profile page** — shows your avatar, name, email, settings rows, and Sign Out button |

### Services (`services/`)

| File | One-sentence job |
|---|---|
| `api/client.ts` | **The waiter** — sends GET/POST/PUT/DELETE requests to the backend with the JWT token, handles timeouts (30s — Railway cold start) and errors |
| `storage/secure-store.ts` | **The locker** — saves the JWT token to secure storage (or web storage), reads it back, and deletes it on logout |

### State (`stores/`)

| File | One-sentence job |
|---|---|
| `auth-store.ts` | **The manager** — remembers who is logged in (user + token) across ALL screens, provides setAuth/clearAuth |

### Types (`types/`)

| File | One-sentence job |
|---|---|
| `index.ts` | **The menu** — defines the shapes of User, AuthResponse, SignUpRequest, LoginRequest so all code agrees |

### Design (`constants/`)

| File | One-sentence job |
|---|---|
| `colors.ts` | **The paint guide** — defines every color (blue buttons, gray text, red errors, white backgrounds) |
| `spacing.ts` | **The ruler** — defines spacing sizes (4px, 8px, 16px, 24px, etc.) so everything lines up |
| `typography.ts` | **The font guide** — defines font sizes (12px to 40px) and weights (regular to bold) |

### Config Files

| File | One-sentence job |
|---|---|
| `app.json` | **App ID card** — tells Expo the app name, Android package name, iOS bundle ID, and which plugins to use |
| `package.json` | **Shopping list** — lists every library the app needs (React Native, Expo, Zustand, etc.) |
| `.env` | **Secret address** — stores the backend URL (`https://roundup-app-production.up.railway.app`) |
| `tsconfig.json` | **Grammar checker** — TypeScript settings that catch mistakes before you run the app |

---

## 6. Key Concepts Explained (No Jargon)

### What is React Native?

Normally, to make an Android app you write **Java/Kotlin**, and to make an iPhone app you write **Swift**. That's TWO completely different languages. React Native lets you write **one code in JavaScript/TypeScript** and it runs on both.

**Think of it like:** You write a recipe in English. A translator turns it into Hindi (Android) and Arabic (iPhone). Same recipe, different languages.

### What is Expo?

React Native by itself is painful to set up (you need Android Studio, Xcode, SDKs, etc.). **Expo handles all that setup** so you can just write code and see it instantly.

- **Development:** You scan a QR code with the "Expo Go" app on your phone → your code appears instantly
- **Building:** When ready, Expo packages it into a real .apk (Android) or .ipa (iPhone) file for the Play Store / App Store
- **Web:** Expo can also build it as a website with one command

### What is Expo Router?

It's a **navigation system** that reads your folder structure and turns it into screens.

```
app/(auth)/login.tsx   →   becomes the login screen at URL /login
app/(tabs)/home.tsx    →   becomes the home screen at /home
```

The `(auth)` and `(tabs)` folder names are just **groups** — they don't appear in the URL. They just organize related screens.

### What is a JWT Token?

**JWT** = JSON Web Token. It's a digitally signed "ticket" the backend gives you when you log in.

```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.dQw4w9WgXcQ
```

It has 3 parts (separated by dots):

1. **Header** — says "I'm a JWT token"
2. **Body/Payload** — says "user id = 1, expires in 24 hours"
3. **Signature** — a secret stamp that proves the backend made this, not a fake

**Why use it?** Instead of sending your password every time, you send this token. It's like a hotel keycard — the front desk gives it to you at check-in, and you just flash it to get into your room.

### What is Zustand?

Zustand is a **state manager** — a box that stores data (like "who is logged in") and any screen can grab it.

```
auth-store.ts remembers:
  "user = { name: 'John', email: 'john@email.com' }"
  "token = 'xxx.yyy.zzz'"
  
Now home.tsx grabs it:
  const user = useAuthStore(s => s.user)
  // user.name → "John" ✓
```

### What is React Hook Form + Zod?

- **React Hook Form:** Connects your text inputs to validation rules
- **Zod:** Defines the rules (email must have @, password must be 8+ chars)

Together they work like a **bouncer + clipboard** at a club:

1. You fill out the form (type email, password)
2. Tap "Sign In"
3. Zod checks: "Is this a real email? Is password not empty?"
4. ❌ Bad email → show "Enter a valid email" under the field
5. ✅ All good → send to backend

---

## 7. The Technology Stack (Full Picture)

```
┌─────────────────────────────────────────────────────────────┐
│                    ROUNDUP APP                               │
├─────────────────────────────────────────────────────────────┤
│  ANDROID APP  │  iPHONE APP  │     WEB BROWSER              │
│  (.apk file)  │  (.ipa file) │  (localhost:3000)             │
├─────────────────────────────────────────────────────────────┤
│                  REACT NATIVE (0.81.5)                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  EXPO SDK 54                                            │ │
│  │  ┌─────────────┐ ┌──────────┐ ┌───────────────────┐    │ │
│  │  │ Expo Router │ │ Zustand │ │ React Query       │    │ │
│  │  │ (screens)   │ │ (memory) │ │ (server data)     │    │ │
│  │  ├─────────────┤ ├──────────┤ ├───────────────────┤    │ │
│  │  │ React Hook  │ │ Secure   │ │ StyleSheet       │    │ │
│  │  │ Form + Zod  │ │ Store    │ │ (styling)         │    │ │
│  │  └─────────────┘ └──────────┘ └───────────────────┘    │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    API CLIENT (fetch)                        │
│              ↓ HTTP requests (JSON) ↑                       │
├─────────────────────────────────────────────────────────────┤
│              SPRING BOOT BACKEND (Java 17)                   │
│  ┌──────────┐ ┌───────────┐ ┌────────────────────────────┐  │
│  │ Security │ │ Auth      │ │ JWT Token Provider         │  │
│  │ Config   │ │ Controller│ │ (create + verify tokens)   │  │
│  ├──────────┤ ├───────────┤ ├────────────────────────────┤  │
│  │ Auth     │ │ User      │ │ PostgreSQL (or H2 for dev) │  │
│  │ Service  │ │ Repository│ │                            │  │
│  └──────────┘ └───────────┘ └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Quick Glossary

| Term | Plain English |
|---|---|
| **React Native** | Write one code → runs on Android, iPhone, Web |
| **Expo** | Makes React Native easy — no complex setup needed |
| **Expo Router** | Reads your file folders and turns them into app screens |
| **Zustand** | A memory box that remembers data across screens |
| **React Query** | Auto-refreshes data from the backend |
| **React Hook Form** | Connects form inputs to validation |
| **Zod** | Defines validation rules (email format, password length) |
| **JWT** | A digital keycard proving you're logged in |
| **SecureStore** | Encrypted phone storage for the JWT token |
| **API** | The messenger between the app and the backend |
| **Endpoint** | A specific URL for a specific action (`/api/auth/login`) |
| **TypeScript** | JavaScript with safety nets — catches mistakes early |
| **State** | Data that changes over time (logged in / logged out) |
| **Component** | A piece of the screen (like a Lego brick) |
| **Hook** | A reusable piece of logic (like useAuthStore) |

---

> **Next up:** the design overhaul — a celebration screen with confetti after every payment, dark-mode theming, savings streaks, and a goal progress ring. This guide explains the core architecture; those features build on the exact same patterns you just learned. 🎉
