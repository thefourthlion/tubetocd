# TubeToCD — API

Express + SQLite backend for [TubeToCD](https://tubetocd.com). Resolves YouTube URLs, converts to MP3/MP4 (via **yt-dlp** + **ffmpeg**), and stores user libraries, playlists, and ratings.

Default port: **3025**

## Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 22+, Express |
| DB | SQLite + Sequelize |
| Auth | JWT (bcrypt password hashes) |
| Media | yt-dlp, ffmpeg |
| Optional AI | OpenAI (`/api/ai/name-tracks`) |

## Prerequisites

- Node.js **22+**
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org/) on `PATH`  
  macOS: `brew install yt-dlp ffmpeg`
- npm

Docker images install yt-dlp + ffmpeg for you.

## Quick start

```bash
cp .env.example .env
# Set a strong JWT_SECRET before any real usage
npm install
npm run dev          # nodemon
# or
npm start            # node index.js
```

API: [http://localhost:3025](http://localhost:3025)  
Root health: `GET /` → `{ "app": "tubetocd-api", "status": "running", ... }`

SQLite DB is created at `DATABASE_PATH` (default `./data/database.sqlite`) if missing. Existing files are never overwritten.

## Environment

Copy `.env.example` → `.env`. **Never commit `.env`.**

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PORT` | No | `3025` | Listen port |
| `DATABASE_PATH` | No | `./data/database.sqlite` | SQLite file |
| `JWT_SECRET` | **Yes (prod)** | insecure fallback | Sign auth tokens |
| `JWT_EXPIRES_IN` | No | `7d` | Token lifetime |
| `CORS_ORIGINS` | No | — | Extra allowed origins (comma-separated) |
| `NODE_ENV` | No | — | `production` disables loose localhost CORS |
| `YT_DLP_PATH` | No | `yt-dlp` | Absolute path if not on PATH |
| `YT_DLP_COOKIES_FROM_BROWSER` | No | — | e.g. `chrome` — reduces YouTube 403s |
| `YT_DLP_COOKIES` | No | — | Path to cookies.txt |
| `YT_DLP_EXTRACTOR_ARGS` | No | android/web/tv clients | yt-dlp extractor args |
| `LISTEN_CACHE_TTL_MS` | No | 48h | Listen-stream MP3 cache TTL |
| `OPENAI_API_KEY` | For AI naming | — | Enables `/api/ai/name-tracks` |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Model for naming |

Defaults already allow CORS from `https://tubetocd.com`, `https://www.tubetocd.com`, and `http://localhost:3024`.

### Production `.env` sketch

```env
NODE_ENV=production
PORT=3025
DATABASE_PATH=/app/data/database.sqlite
JWT_SECRET=<long-random-string>
JWT_EXPIRES_IN=7d
CORS_ORIGINS=
OPENAI_API_KEY=
```

Generate a secret: `openssl rand -base64 48`

## Docker

```bash
cp .env.example .env   # set JWT_SECRET (and optional OPENAI_API_KEY)
docker compose up --build -d
```

- Image: Node 22 Alpine + yt-dlp + ffmpeg
- Host port **3025**
- Volumes: `sqlite_data` → `/app/data`, `downloads_data` → `/app/downloads`
- `env_file: .env` plus `NODE_ENV=production`
- Healthcheck hits `GET /`

```bash
docker compose logs -f
docker compose down
```

## API overview

### Auth

| Method | Path | Auth | Body |
|--------|------|------|------|
| `POST` | `/api/auth/register` | — | `email`, `password` (≥6), optional `name` |
| `POST` | `/api/auth/login` | — | `email`, `password` |
| `GET` | `/api/auth/me` | Bearer | — |

Send `Authorization: Bearer <token>` on protected routes.

### Download / YouTube

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/download/info` | — | Resolve video/playlist/channel metadata |
| `POST`/`GET` | `/api/download/search` | — | Keyword search |
| `POST` | `/api/download/` | optional | Single file download |
| `POST` | `/api/download/batch` | optional | Multi-track / zip |
| `POST`/`GET` | `/api/download/stream` | — | Listen preview stream |

### Library (Bearer required)

| Prefix | Purpose |
|--------|---------|
| `/api/youtubeLinks` | Saved video links CRUD |
| `/api/playlists` | Saved playlists/channels + tracks |
| `/api/library` | Combined library search |
| `/api/ratings` | Per-user star ratings |

### AI (optional)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/ai/name-tracks` | Bearer | Needs `OPENAI_API_KEY` |

## Project layout

```
server/
├── index.js           # App entry, route mount
├── config/            # database, cors
├── controllers/       # auth, download, playlists, …
├── middleware/        # auth, optionalAuth
├── models/            # User, Playlist, PlaylistTrack, Rating, youtubeLinks
├── routes/
├── utils/             # yt-dlp helpers
├── data/              # SQLite (gitignored files)
├── downloads/         # Media cache (gitignored)
├── Dockerfile
└── docker-compose.yml
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Production: `node index.js` |
| `npm run dev` | Development: nodemon |
| `npm test` | Placeholder |

## Production checklist

1. Set a strong unique `JWT_SECRET` (server refuses to stay quiet if the default is used in production — check logs)
2. `NODE_ENV=production`
3. Persist `/app/data` (and optionally `/app/downloads`) via volumes or bind mounts
4. Put TLS termination in front (nginx, Caddy, cloud LB) for `api.tubetocd.com`
5. Install/update yt-dlp regularly (`brew upgrade yt-dlp` or rebuild the image)
6. If YouTube returns 403s, configure `YT_DLP_COOKIES_FROM_BROWSER` or a cookies file
7. Back up `database.sqlite` on a schedule

## Related

- Client: `../client`
- Support: hello@tubetocd.com
