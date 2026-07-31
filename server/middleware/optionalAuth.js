const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../config/jwt");

/** Attaches req.user when a valid Bearer token is present; otherwise continues anonymously. */
module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next();
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, getJwtSecret());
  } catch {
    // Ignore invalid tokens for optional auth
  }
  next();
};
