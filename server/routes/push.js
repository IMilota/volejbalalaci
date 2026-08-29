const express = require("express");
const { sendError } = require("../http/errors");
const { asyncHandler } = require("../http/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const PushSubscription = require("../models/push-subscription");
const { isPushConfigured } = require("../services/push");

const router = express.Router();

router.use(requireAuth);

router.post(
  "/subscribe",
  asyncHandler(async (req, res) => {
    if (!isPushConfigured()) {
      return sendError(res, 503, "pushNotConfigured", "Web Push is not configured");
    }
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return sendError(res, 400, "dtoInIsNotValid", "invalid push subscription");
    }
    let sub = await PushSubscription.findOne({ endpoint });
    if (sub) {
      sub.userId = req.user._id;
      sub.p256dh = keys.p256dh;
      sub.auth = keys.auth;
      await sub.save();
    } else {
      sub = await PushSubscription.create({
        userId: req.user._id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
    }
    res.json(sub.toJSON());
  })
);

router.delete(
  "/subscribe",
  asyncHandler(async (req, res) => {
    const endpoint = req.body?.endpoint;
    if (!endpoint) {
      return sendError(res, 400, "dtoInIsNotValid", "endpoint is required");
    }
    await PushSubscription.deleteOne({ endpoint, userId: req.user._id });
    res.json({ ok: true });
  })
);

module.exports = router;
