const express = require("express");
const mongoose = require("mongoose");
const { sendError } = require("../http/errors");
const { asyncHandler } = require("../http/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const Message = require("../models/message");
const PushSubscription = require("../models/push-subscription");
const { sendPushToUserIds } = require("../services/push");

const router = express.Router();

router.use(requireAuth);

async function notifyOthers(req, message) {
  const userIds = await PushSubscription.distinct("userId", {
    userId: { $ne: req.user._id },
  });
  await sendPushToUserIds(userIds, {
    type: "message",
    messageId: String(message._id),
    eventId: message.eventId ? String(message.eventId) : null,
    title: req.user.nickname,
    body: message.body,
  });
}

function canManageMessage(user, message) {
  return user.role === "admin" || String(user._id) === String(message.authorId);
}

async function loadMessage(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Message.findById(id);
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter =
      req.query.eventId === undefined ? { eventId: null } : { eventId: req.query.eventId };
    const messages = await Message.find(filter).sort({ createdAt: 1 });
    res.json(messages.map((message) => message.toJSON()));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { body, eventId, replyToId } = req.body || {};
    if (replyToId) {
      const reply = await Message.createReply(replyToId, {
        authorId: req.user._id,
        body,
        eventId: eventId !== undefined ? eventId : undefined,
      });
      await notifyOthers(req, reply);
      return res.json(reply.toJSON());
    }
    const message = await Message.create({
      eventId: eventId ?? null,
      authorId: req.user._id,
      body,
    });
    await notifyOthers(req, message);
    res.json(message.toJSON());
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const message = await loadMessage(req.params.id);
    if (!message) {
      return sendError(res, 404, "messageNotFound", "message not found");
    }
    if (!canManageMessage(req.user, message)) {
      return sendError(res, 403, "forbidden", "cannot update this message");
    }
    message.body = req.body?.body;
    await message.save();
    res.json(message.toJSON());
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const message = await loadMessage(req.params.id);
    if (!message) {
      return sendError(res, 404, "messageNotFound", "message not found");
    }
    if (!canManageMessage(req.user, message)) {
      return sendError(res, 403, "forbidden", "cannot delete this message");
    }
    await message.deleteWithReplies();
    res.json({ ok: true });
  })
);

module.exports = router;
