const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../config/jwt");

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, getJwtSecret());
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
