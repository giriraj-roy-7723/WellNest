const jwt = require("jsonwebtoken");

const JWT_SECRET = "super-secret-key"; // same secret as auth server

function authMiddleware(req, res, next) {
  const token = req.cookies.authToken;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
module.exports = { authMiddleware };
