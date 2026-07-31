# Base image
FROM node:22-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci

# Builder stage — static export (`output: 'export'` → `out/`)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* must be present at build time (baked into the static bundle)
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3024
ARG NEXT_PUBLIC_API_URL=http://localhost:3025
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Runner stage — serve the static `out/` folder
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3024

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && npm install -g serve@14

COPY --from=builder --chown=nextjs:nodejs /app/out ./out

USER nextjs

EXPOSE 3024

CMD ["serve", "out", "-l", "3024"]
