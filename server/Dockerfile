FROM node:22-alpine

WORKDIR /app

# Native module build tools + yt-dlp/ffmpeg for YouTube downloads
RUN apk add --no-cache python3 make g++ ffmpeg curl ca-certificates \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && yt-dlp --version

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/data /app/downloads

ENV NODE_ENV=production
ENV PORT=3025
ENV DATABASE_PATH=/app/data/database.sqlite

EXPOSE 3025

CMD ["node", "index.js"]
