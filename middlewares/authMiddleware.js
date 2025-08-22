const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key";

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ success: false, message: "Invalid token" });
  }
}

module.exports = authMiddleware;
