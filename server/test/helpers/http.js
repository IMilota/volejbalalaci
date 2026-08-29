const crypto = require("crypto");
const { hashToken } = require("../../helpers/hash-token");
const Session = require("../../models/session");

async function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  await Session.create({
    userId: user._id,
    tokenHash: hashToken(token),
    lastUsedAt: new Date(),
  });
  return token;
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createSession, bearer };
