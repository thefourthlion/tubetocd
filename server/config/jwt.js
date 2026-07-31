const DEFAULT_DEV_SECRET = "dev-secret-change-me";

const WEAK_SECRETS = new Set([
  DEFAULT_DEV_SECRET,
  "change-me-to-a-long-random-string",
  "secret",
  "jwt-secret",
]);

function getJwtSecret() {
  return process.env.JWT_SECRET || DEFAULT_DEV_SECRET;
}

function isWeakJwtSecret(secret = getJwtSecret()) {
  return !secret || WEAK_SECRETS.has(secret) || secret.length < 16;
}

function assertJwtConfig() {
  const secret = getJwtSecret();
  if (!isWeakJwtSecret(secret)) return;

  const msg =
    "JWT_SECRET is missing or weak. Set a strong secret (e.g. openssl rand -base64 48) before production traffic.";

  if (process.env.NODE_ENV === "production") {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }

  console.warn(`⚠️  ${msg}`);
}

module.exports = {
  getJwtSecret,
  isWeakJwtSecret,
  assertJwtConfig,
  getJwtExpiresIn: () => process.env.JWT_EXPIRES_IN || "7d",
};
