const crypto = require("crypto");
const express = require("express");
const { hashToken } = require("../helpers/hash-token");
const { sendError } = require("../http/errors");
const { asyncHandler } = require("../http/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const User = require("../models/user");
const LoginChallenge = require("../models/login-challenge");
const Session = require("../models/session");
const { sendMagicLink } = require("../services/mail");

const router = express.Router();
const CHALLENGE_TTL_MS = 30 * 60 * 1000;

router.post(
  "/challenge",
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) {
      return sendError(res, 400, "dtoInIsNotValid", "email is required");
    }
    const user = await User.findOne({ email });
    if (user) {
      const plaintext = crypto.randomBytes(32).toString("hex");
      await LoginChallenge.create({
        userId: user._id,
        tokenHash: hashToken(plaintext),
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      });
      await sendMagicLink({
        to: user.email,
        url: `${process.env.APP_BASE_URL}/login?token=${plaintext}`,
      });
    }
    res.json({ ok: true });
  })
);

router.post(
  "/consume",
  asyncHandler(async (req, res) => {
    const token = req.body?.token;
    if (!token || typeof token !== "string") {
      return sendError(res, 401, "unauthorized", "invalid token");
    }
    const challenge = await LoginChallenge.findOneAndUpdate(
      {
        tokenHash: hashToken(token),
        consumedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      },
      { $set: { consumedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!challenge) {
      return sendError(res, 401, "unauthorized", "invalid token");
    }
    const sessionToken = crypto.randomBytes(32).toString("hex");
    await Session.create({
      userId: challenge.userId,
      tokenHash: hashToken(sessionToken),
      lastUsedAt: new Date(),
    });
    const user = await User.findById(challenge.userId);
    res.json({ token: sessionToken, user: user.toJSON() });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await Session.deleteOne({ _id: req.session._id });
    res.json({ ok: true });
  })
);

router.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await Session.deleteMany({ userId: req.user._id });
    res.json({ ok: true });
  })
);

module.exports = router;
