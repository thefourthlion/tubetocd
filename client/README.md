# TubeToCD — Client

Next.js 15 frontend for [TubeToCD](https://tubetocd.com): turn YouTube videos, playlists, and channels into MP3/MP4 downloads with a personal music library.

Static export (`output: "export"`) for web + Capacitor (iOS). Talks to the Express API in `../server`.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router), TypeScript |
| UI | Tailwind, NextUI, Framer Motion |
| Auth | JWT via TubeToCD API (`localStorage`) |
| Native | Capacitor 8 (iOS) |
| Deploy | Static `out/` via Docker (`serve`) or any static host |

## Prerequisites

- Node.js **22+**
- npm
- Running API (see `../server`) on port **3025** for local dev

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

App: [http://localhost:3024](http://localhost:3024)

### Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical site URL (SEO, Open Graph) |
| `NEXT_PUBLIC_API_URL` | Yes | TubeToCD API base URL |

**Local**

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3024
NEXT_PUBLIC_API_URL=http://localhost:3025
```

**Production** (bake these in at **build** time — `NEXT_PUBLIC_*` is compiled into the static bundle)

```env
NEXT_PUBLIC_SITE_URL=https://tubetocd.com
NEXT_PUBLIC_API_URL=https://api.tubetocd.com
```

Never commit `.env`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with Turbopack (port 3024) |
| `npm run build` | Static export → `out/` |
| `npm start` | Serve `out/` on port 3024 |
| `npm run lint` | ESLint with `--fix` |
| `npm run cap:sync:ios` | Build, sync Capacitor iOS, apply config |
| `npm run cap:run:ios` | Sync + run on iOS simulator/device |
| `npm run dev:ios` | Live-reload iOS workflow |

## Docker

```bash
# Ensure .env has production (or local) NEXT_PUBLIC_* values
docker compose up --build -d
```

- Builds a multi-stage image (Node 22 Alpine)
- Passes `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_API_URL` as build args
- Serves static `out/` on **3024**
- Healthcheck: `http://127.0.0.1:3024`

```bash
docker compose logs -f
docker compose down
```

## Pages

| Path | Notes |
|------|-------|
| `/` | Marketing landing |
| `/home` | Music desk (auth) |
| `/pages/convert` | Paste URL → preview, rename, download |
| `/pages/cd` | Build a CD (capacity + burn zip) |
| `/pages/saved` | Personal library (auth) |
| `/pages/listen` | Stream / download single track |
| `/pages/watch` | YouTube watch UI |
| `/pages/playlists/detail` | Saved playlist/channel |
| `/pages/login` · `/pages/register` · `/pages/account` | Auth |
| `/pages/privacy` · `/pages/terms` · `/pages/contact` | Legal |

## Project layout

```
client/
├── app/                 # App Router pages + layout
├── components/          # UI (navbar, player, desk, etc.)
├── config/              # site.ts, fonts
├── lib/                 # api-base, auth, youtube, playlists, player
├── public/              # Static assets (og.png for social previews)
├── styles/              # Global + feature SCSS
├── Dockerfile           # Production static image
└── docker-compose.yml
```

## Production checklist

1. Set production URLs in `.env` **before** `npm run build` / `docker compose build`
2. `public/og.png` ships for social sharing (replace anytime; 1200×630 recommended)
3. Point DNS / reverse proxy: `tubetocd.com` → this static site; API separately
4. Confirm API CORS allows `https://tubetocd.com` (defaults already include it)
5. Rebuild after any env change — static export does not read runtime env

## Capacitor (iOS)

```bash
npm run cap:sync:ios
# then open ios/ in Xcode, or:
npm run cap:run:ios
```

- `capacitor.config.ts`: `appId` `com.tubetocd.app`, `webDir` `out`
- Requires Xcode on macOS

## Related

- API: `../server`
- Support: hello@tubetocd.com
