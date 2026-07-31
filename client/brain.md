# Client Brain

> This is the architectural source of truth for the client application.
> The AI must consult this file before writing any client-side code.
> If reality drifts from this document, update the document — don't ignore it.

---

## Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| **Framework** | Next.js (App Router) | 15.x, `app/` directory, Turbopack in dev |
| **Language** | TypeScript | Strict mode. All new files must be `.tsx` / `.ts`. |
| **Styling** | Tailwind CSS + SCSS | Tailwind for utility classes, SCSS for component-scoped styles. |
| **UI Libraries** | NextUI v2, shadcn/ui (New York style, Zinc base) | NextUI for interactive components (navbar, switch, form, input). shadcn/ui for composable primitives (card, avatar). |
| **Icons** | Lucide React, custom SVG components in `components/icons.tsx` | |
| **Fonts** | Inter (sans), Fira Code (mono), Sofia Sans (via Google Fonts in globals.scss) | Loaded through `next/font` in `config/fonts.ts` |
| **Auth** | Firebase Authentication | Email/password + Google OAuth. `react-firebase-hooks` for state. |
| **Database / Backend** | Firebase Firestore | Real-time subscriptions for Stripe data. |
| **Payments** | Stripe via Firebase Extensions | Checkout sessions through Firestore. Portal via Firebase Functions. |
| **HTTP Client** | Axios | For external API calls. |
| **Toasts** | sonner | `<Toaster />` in root layout; `toast.error()` / `toast.success()` anywhere. |
| **Utilities** | clsx, tailwind-merge, class-variance-authority, tailwind-variants | `cn()` helper in `lib/utils.ts`. |
| **Build** | Standalone output for Docker | Multi-stage Dockerfile, Node 18 Alpine. |

---

## Directory Structure

```
client/
├── app/                          # Next.js App Router
│   ├── pages/                    # Page routes (grouped by feature)
│   │   ├── account/              # Account management
│   │   │   ├── page.tsx
│   │   │   ├── stripePayment.tsx # Stripe checkout/portal helpers
│   │   │   └── getPremiumStatus.ts
│   │   ├── login/page.tsx
│   │   ├── products/page.tsx     # Pricing / subscription tiers
│   │   ├── register/page.tsx
│   │   └── test/pages.tsx
│   ├── authRouter.tsx            # Route protection wrapper
│   ├── error.tsx                 # Route-level error boundary
│   ├── global-error.tsx          # Root layout error boundary
│   ├── layout.tsx                # Root layout (providers, navbar, footer)
│   ├── not-found.tsx             # 404 page
│   ├── page.tsx                  # Home page
│   └── providers.tsx             # NextUI + next-themes provider
├── components/                   # Shared components
│   ├── ui/                       # shadcn/ui primitives (card, avatar)
│   ├── footer.tsx
│   ├── icons.tsx                 # Custom SVG icon components
│   ├── navbar.tsx
│   ├── primitives.ts             # Tailwind Variants (title, subtitle)
│   ├── test.tsx
│   └── theme-switch.tsx
├── config/                       # App-wide configuration
│   ├── fonts.ts                  # next/font definitions
│   └── site.ts                   # Site name, description, links
├── .env.example                  # Env var template (Firebase, Stripe); copy to .env
├── lib/                          # Utility functions
│   └── utils.ts                  # cn() — clsx + tailwind-merge
├── public/                       # Static assets
├── styles/                       # Global and component SCSS
│   ├── Variables.scss            # Color palette, dark mode vars
│   ├── globals.scss              # Tailwind imports, resets, typography
│   ├── Account.scss
│   ├── Footer.scss
│   ├── Login.scss
│   ├── Product.scss
│   ├── Register.scss
│   └── Test.scss
├── types/                        # Shared TypeScript types
│   └── index.ts                  # IconSvgProps, etc.
├── firebase.ts                   # Firebase app init + auth export
├── components.json               # shadcn/ui config
├── next.config.js                # Standalone output
├── tailwind.config.js            # NextUI plugin, dark mode, fonts
├── tsconfig.json                 # Strict, path alias @/*
├── postcss.config.js
├── .eslintrc.json
├── Dockerfile                    # Multi-stage production build
└── docker-compose.yml            # Dev: port 3000
```

---

## Architecture Rules

### Routing & Pages

- **App Router only.** All routes live under `app/`.
- **Feature pages** go in `app/pages/{feature}/page.tsx`.
- **Route protection** is handled by `authRouter.tsx`, which wraps all children in the root layout and redirects based on Firebase auth state.
  - Protected routes: `/pages/account`, `/pages/hidden`
  - If logged in and on `/pages/login` → redirect to `/pages/account`
  - If logged out and on a protected route → redirect to `/pages/login`

### Components

- **Shared / reusable UI** → `components/` (navbar, footer, theme-switch, icons).
- **shadcn/ui primitives** → `components/ui/` (card, avatar). These follow the Radix + forwardRef + `cn()` pattern.
- **Feature-specific components** can live alongside their page or in `components/features/{feature}/` if reused.
- **Pages should be thin.** Logic should live in helpers, hooks, or child components — not in the page file itself.

### Styling

- **Tailwind** for layout, spacing, typography, and utility classes.
- **SCSS** for component-scoped styles (one `.scss` file per feature in `styles/`).
- **Variables.scss** holds the color palette and dark mode colors. Use `@use "./Variables" as *` in any SCSS file that needs colors.
- **globals.scss** imports Tailwind, Variables, Google Fonts, and defines global resets / button classes.
- **NextUI theme** provides dark mode via class strategy. Theme switching is in `theme-switch.tsx` using `next-themes`.
- **`cn()` utility** (`lib/utils.ts`) for conditional / merged class names.
- **Tailwind Variants** (`components/primitives.ts`) for reusable style presets (title gradients, subtitle).
- **Mobile-first** design approach.

### State Management

- **React hooks** (useState, useEffect) for local state.
- **react-firebase-hooks** for auth state (`useAuthState`).
- **Firebase Firestore** real-time subscriptions for server state (Stripe data, subscriptions).
- No global state library. If one is needed, discuss before adding.

### Data Fetching

- Server Components for static / initial data when possible.
- Client-side Firebase SDK for auth state and Firestore queries.
- **Do not use `useEffect` for data fetching** when a Server Component or Server Action would work.

### Authentication

- **Firebase Auth** — initialized in `firebase.ts`.
- **Email/password** and **Google OAuth**.
- Auth state is tracked with `useAuthState(auth)` from `react-firebase-hooks/auth`.
- Route protection is in `authRouter.tsx` (client-side redirect based on auth state).
- Social login buttons use `react-social-login-buttons`.

### Products & Pricing

- **Products are stored in the server DB** (PostgreSQL via the Product model). The products page fetches from `NEXT_PUBLIC_API_URL/api/Product/read` on mount.
- **Fallback:** If the API call fails, the page falls back to hardcoded product data using `NEXT_PUBLIC_STRIPE_PRICE_*` env vars. This means the page always renders even if the server is down.
- **Product schema:** `Title`, `Price`, `Benefits` (comma-separated string), `StripeId`.

### Payments

- **Stripe** via the Firebase Extensions `@invertase/firestore-stripe-payments`.
- **Checkout:** Write to a Firestore collection (`customers/{uid}/checkout_sessions`), listen for the session URL, redirect.
- **Portal:** Call a Firebase Function (`ext-firestore-stripe-payments-createPortalLink`).
- **Subscription status:** Query `customers/{uid}/subscriptions` in Firestore, filter for `trialing` or `active`.
- Stripe price IDs come from the Product DB records (`StripeId` field) or `NEXT_PUBLIC_STRIPE_PRICE_*` env vars as fallback.

---

## Coding Style

| Convention | Rule |
|-----------|------|
| **File extension** | `.tsx` for components with JSX, `.ts` for logic-only. All new files must be TypeScript. |
| **Component naming** | PascalCase file and export (`UserProfile.tsx`, `export const UserProfile`). |
| **Function / variable naming** | camelCase. |
| **Exports** | Named exports preferred (`export const Component = ...`). Default exports only for page files (`export default function Page()`). |
| **Client components** | Mark with `"use client"` at the top. |
| **Imports** | Use `@/` path alias. Group: (1) external packages, (2) internal modules, (3) styles. |
| **Types** | Define in `types/` for shared types. Co-locate with feature if specific to one component. |
| **Guard clauses** | Prefer early returns over nested `if/else`. |
| **Async** | `async/await` over `.then()`. |
| **Console** | `console.log` triggers an ESLint warning. Remove before committing or use a proper logger. |
| **Unused imports** | Caught by `eslint-plugin-unused-imports`. |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client config (from Firebase console) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase Analytics (optional) |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | Stripe publishable key (client-accessible) |
| `NEXT_PUBLIC_STRIPE_PRICE_BASIC` | Stripe price ID for Basic tier |
| `NEXT_PUBLIC_STRIPE_PRICE_PREMIUM` | Stripe price ID for Premium tier |
| `NEXT_PUBLIC_STRIPE_PRICE_ULTIMATE` | Stripe price ID for Ultimate tier |
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:3002`) |

Firebase config is read from env in `firebase.ts`. All secrets and config live in `.env` (copy from `.env.example`).

---

## Build & Deploy

- **Dev:** `npm run dev` (Turbopack, port 3000).
- **Build:** `npm run build --no-lint` → standalone output.
- **Docker:** Multi-stage Dockerfile (deps → build → runner). Non-root `nextjs` user. Port 3000.
- **Docker Compose:** `project-client` service, port 3000, healthcheck, restart always.

---

## Known Patterns to Preserve

1. `authRouter.tsx` wraps the app for route protection — don't bypass it.
2. Stripe flows go through Firestore, not direct Stripe API calls on the client.
3. shadcn/ui components use Radix + forwardRef + `cn()` — follow the same pattern when adding new ones.
4. SCSS files in `styles/` use `@use "./Variables" as *` for colors.
5. `config/site.ts` is the single source of truth for site metadata.

---

## Known Issues & Tech Debt

- [x] ~~Upload API route had no auth check.~~ Removed entirely — avatars come from Google OAuth `photoURL` or a fallback initial.
- [x] ~~Stripe price IDs are hardcoded in the products page.~~ Moved to `NEXT_PUBLIC_STRIPE_PRICE_*` env vars.
- [x] ~~No structured error handling beyond the global error boundary.~~ Added sonner toasts for all async operations, `global-error.tsx` for root layout crashes.
