/**
 * Allowed browser origins for CORS.
 * Production: tubetocd.com → api.tubetocd.com
 * Development: localhost:3024 → localhost:3025
 *
 * Extra origins: comma-separated CORS_ORIGINS in .env
 */
function parseExtraOrigins() {
  return String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const DEFAULT_ORIGINS = [
  "https://tubetocd.com",
  "https://www.tubetocd.com",
  "http://localhost:3024",
  "http://127.0.0.1:3024",
  // Legacy local ports while migrating
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function allowedOrigins() {
  return [...new Set([...DEFAULT_ORIGINS, ...parseExtraOrigins()])];
}

function isDevLocalOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function corsOrigin(origin, callback) {
  // curl / server-to-server / same-origin navigations often omit Origin
  if (!origin) {
    return callback(null, true);
  }

  if (allowedOrigins().includes(origin)) {
    return callback(null, true);
  }

  // In non-production, allow any localhost port for flexibility
  if (process.env.NODE_ENV !== "production" && isDevLocalOrigin(origin)) {
    return callback(null, true);
  }

  console.warn(`CORS blocked origin: ${origin}`);
  return callback(new Error(`Not allowed by CORS: ${origin}`));
}

const corsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "X-Requested-With",
  ],
  exposedHeaders: [
    "Content-Disposition",
    "X-Video-Title",
    "X-Video-Id",
    "X-Saved-Id",
    "X-Thumbnail",
    "X-Download-Format",
    "X-Download-Quality",
  ],
  maxAge: 86400,
};

module.exports = { corsOptions, allowedOrigins };
