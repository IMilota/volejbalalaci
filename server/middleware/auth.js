const { hashToken } = require("../helpers/hash-token");
const Session = require("../models/session");
const User = require("../models/user");
const { sendError } = require("../http/errors");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      return sendError(res, 401, "unauthorized", "missing token");
    }
    const session = await Session.findOne({ tokenHash: hashToken(token) });
    if (!session) {
      return sendError(res, 401, "unauthorized", "invalid token");
    }
    const user = await User.findById(session.userId);
    if (!user) {
      return sendError(res, 401, "unauthorized", "invalid token");
    }
    session.lastUsedAt = new Date();
    await session.save();
    req.user = user;
    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return sendError(res, 403, "forbidden", "admin only");
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
