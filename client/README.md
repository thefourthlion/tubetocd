# Client — Next.js Auth & Payments Template

A production-ready Next.js client with Firebase authentication (email/password + Google OAuth), Stripe subscription payments via Firestore, and dark mode — all wired up and ready to clone.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router) | `app/` directory, Turbopack in dev, standalone Docker output |
| **Language** | TypeScript | Strict mode. All files are `.tsx` / `.ts`. |
| **Styling** | Tailwind CSS + SCSS | Tailwind for utilities, SCSS for component-scoped styles |
| **UI** | [NextUI v2](https://nextui.org/) + [shadcn/ui](https://ui.shadcn.com/) | NextUI for interactive components, shadcn for composable primitives |
| **Icons** | Lucide React + custom SVGs | Custom icons in `components/icons.tsx` |
| **Auth** | Firebase Authentication | Email/password + Google OAuth via `react-firebase-hooks` |
| **Payments** | Stripe (via Firebase Extensions) | Checkout sessions + customer portal through Firestore |
| **Theming** | next-themes | Dark/light mode with class strategy |

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** (comes with Node)
- **Firebase project** with Authentication enabled (email/password + Google provider)
- **Stripe account** (only if using payments)

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values. See [Environment Variables](#environment-variables) below for what each one does and which are required.

### 3. Run the dev server

```bash
npm run dev
```

The app starts at [http://localhost:3024](http://localhost:3024) with Turbopack for fast refresh.

### Using Docker

```bash
docker compose up --build
```

This builds a multi-stage production image (Node 18 Alpine) and serves on port 3000. Make sure your `.env` is populated — Docker Compose reads it at build time for `NEXT_PUBLIC_*` vars.

---

## Available Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack (port 3024) |
| `npm run build` | Production build (standalone output, linting skipped) |
| `npm start` | Start the production server (run `build` first) |
| `npm run lint` | Run ESLint with auto-fix on `.ts` / `.tsx` files |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values. **Never commit `.env`.**

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase client config — from Firebase Console → Project Settings → Your Apps |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | No | Firebase Analytics measurement ID |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | If using payments | Stripe publishable key (safe for client) |
| `NEXT_PUBLIC_STRIPE_PRICE_BASIC` | If using payments | Stripe price ID for Basic tier |
| `NEXT_PUBLIC_STRIPE_PRICE_PREMIUM` | If using payments | Stripe price ID for Premium tier |
| `NEXT_PUBLIC_STRIPE_PRICE_ULTIMATE` | If using payments | Stripe price ID for Ultimate tier |
| `NEXT_PUBLIC_API_URL` | If using server | Backend API base URL (e.g. `http://localhost:3025` or `https://api.tubetocd.com`) |
| `NEXT_PUBLIC_SITE_URL` | SEO / canonicals | Site URL (e.g. `http://localhost:3024` or `https://tubetocd.com`) |

Firebase config is read in `firebase.ts`. All secrets live in `.env` only — no credentials files.

---

## Project Structure

```
client/
├── app/                            # Next.js App Router
│   ├── pages/                      # Feature pages
│   │   ├── account/                # Account management + Stripe billing
│   │   ├── login/                  # Login (email/password + Google)
│   │   ├── products/               # Pricing / subscription tiers
│   │   ├── register/               # Registration
│   │   └── test/                   # Dev test page
│   ├── authRouter.tsx              # Client-side route protection
│   ├── error.tsx                   # Global error boundary
│   ├── layout.tsx                  # Root layout (providers → auth → navbar → content → footer)
│   ├── not-found.tsx               # 404 page
│   ├── page.tsx                    # Home page
│   └── providers.tsx               # NextUI + next-themes provider wrapper
├── components/                     # Shared components
│   ├── ui/                         # shadcn/ui primitives (card, avatar)
│   ├── footer.tsx                  # Site footer
│   ├── icons.tsx                   # Custom SVG icon components
│   ├── navbar.tsx                  # Top navigation bar
│   ├── primitives.ts              # Tailwind Variants presets (title, subtitle)
│   ├── test.tsx                   # Test component
│   └── theme-switch.tsx           # Dark/light mode toggle
├── config/
│   ├── fonts.ts                   # next/font definitions (Inter, Fira Code)
│   └── site.ts                    # Site name, description, links
├── lib/
│   └── utils.ts                   # cn() — clsx + tailwind-merge
├── styles/                        # Global and component SCSS
│   ├── Variables.scss             # Color palette, dark mode CSS vars
│   ├── globals.scss               # Tailwind imports, resets, typography
│   └── {Feature}.scss             # Per-feature styles
├── types/
│   └── index.ts                   # Shared TypeScript types
├── firebase.ts                    # Firebase app init + auth export
├── .env.example                   # Env var template (copy to .env)
├── components.json                # shadcn/ui configuration
├── next.config.js                 # Standalone output for Docker
├── tailwind.config.js             # NextUI plugin, dark mode, custom fonts
├── tsconfig.json                  # Strict TS, @/* path alias
├── Dockerfile                     # Multi-stage production build
└── docker-compose.yml             # Docker Compose (port 3000)
```

---

## Architecture Overview

### Authentication Flow

1. **Firebase Auth** handles all identity — initialized once in `firebase.ts`.
2. Users sign in via **email/password** or **Google OAuth** on the login page.
3. Auth state is tracked globally with `useAuthState(auth)` from `react-firebase-hooks`.
4. **`authRouter.tsx`** wraps all children in the root layout and enforces route protection:
   - `/pages/account` — protected (redirect to login if unauthenticated)
   - `/pages/login` — redirects to account if already logged in
5. No server-side session. Auth is entirely client-side via Firebase SDK.

### Payments Flow (Stripe via Firestore)

1. User clicks a plan on the **products page**.
2. A **checkout session** document is written to `customers/{uid}/checkout_sessions` in Firestore.
3. The Firebase Stripe extension picks it up, creates a Stripe Checkout session, and writes the session URL back.
4. The client listens for that URL and **redirects to Stripe Checkout**.
5. After payment, Stripe webhooks update Firestore. The client reads subscription status from `customers/{uid}/subscriptions`.
6. The **customer portal** is accessed via a Firebase Function (`ext-firestore-stripe-payments-createPortalLink`).

### Route Protection

| Route | Behavior |
|-------|----------|
| `/pages/account` | Requires auth — redirects to `/pages/login` if logged out |
| `/pages/login` | Redirects to `/pages/account` if already logged in |
| All other routes | Public |

### Styling System

- **Tailwind CSS** — layout, spacing, typography, responsive utilities.
- **SCSS** — component-scoped styles in `styles/`. Each feature gets its own file. Use `@use "./Variables" as *` for the color palette.
- **NextUI theme** — dark mode via class strategy, toggled by `theme-switch.tsx`.
- **`cn()` utility** — merges class names with `clsx` + `tailwind-merge`. Use it everywhere.
- **Tailwind Variants** — reusable style presets defined in `components/primitives.ts`.

---

## Docker

### Build and run

```bash
docker compose up --build
```

### What happens

1. **deps stage** — installs dependencies with `npm ci` on Alpine.
2. **builder stage** — copies source, runs `next build` (standalone output).
3. **runner stage** — minimal image with only the standalone server, static assets, and a non-root `nextjs` user.

The image exposes port **3000** and runs `node server.js`. Health check pings `http://localhost:3000` every 30 seconds.

> **Note:** `NEXT_PUBLIC_*` variables are baked in at build time. Make sure `.env` is present when building the Docker image, or pass them as build args.

---

## Code Style

| Convention | Rule |
|-----------|------|
| File extension | `.tsx` for JSX, `.ts` for logic. All TypeScript. |
| Component naming | PascalCase file and export |
| Functions / variables | camelCase |
| Exports | Named exports preferred; `export default` only for page files |
| Client components | `"use client"` directive at top |
| Imports | `@/` path alias. Group: externals → internals → styles |
| Class names | Use `cn()` for conditional / merged classes |
| Async | `async/await` over `.then()` |
| Console | `console.log` is an ESLint warning — remove before committing |

ESLint config is in `.eslintrc.json`. Run `npm run lint` to check and auto-fix.

---

## Capacitor (Android / iOS)

The app can be built as a static export and wrapped with [Capacitor](https://capacitorjs.com/) for native Android (and optionally iOS) builds.

1. **Install native platforms** (if not already):
   ```bash
   npm install @capacitor/core @capacitor/android @capacitor/ios
   ```

2. **Android — build, sync, and open in Android Studio** (one command):
   ```bash
   npm run cap:open-android
   ```
   This runs `cap:sync`, writes `android/local.properties` with your Android SDK path (so Gradle can find it), then opens the project in Android Studio. You can build and run the app from there.

   **SDK path:** If you see "SDK location not found", install [Android Studio](https://developer.android.com/studio) (it installs the SDK). The script uses `ANDROID_HOME` if set, otherwise the default Mac path `~/Library/Android/sdk`. To fix the path only without opening Studio: `npm run cap:android-setup`.

   **Manual flow:** `npm run cap:sync` then open the `android/` folder in Android Studio.

3. **iOS — build, sync, and open in Xcode** (Mac only):
   ```bash
   npm run cap:open-ios
   ```
   This runs `cap:sync` then opens the iOS project in Xcode. In Xcode, select a simulator or a connected device and run (▶). Safe areas (notch, status bar, home indicator) are already handled in the app via `viewport-fit=cover` and CSS `env(safe-area-inset-*)`.

   **Requirements:** Xcode and the iOS SDK (from the Mac App Store). CocoaPods is used automatically by the project.

**Config:** `capacitor.config.ts` sets `webDir: "out"`. The normal web build still uses `output: "standalone"` (Docker); only `build:capacitor` uses `output: "export"`. Change `appId` / `appName` in `capacitor.config.ts` for your own app.

---

## Using pnpm

If you prefer pnpm, add this to `.npmrc` (already present):

```
public-hoist-pattern[]=*@nextui-org/*
```

Then run `pnpm install` as usual.

---

## Known Issues & Tech Debt

- [ ] **No structured error handling** — beyond the global `error.tsx` boundary. Consider per-feature error boundaries or a toast system.
