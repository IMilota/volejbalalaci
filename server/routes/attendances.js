const express = require("express");
const mongoose = require("mongoose");
const { sendError } = require("../http/errors");
const { asyncHandler } = require("../http/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const Event = require("../models/event");
const Attendance = require("../models/attendance");

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

async function loadEvent(eventId) {
  if (!mongoose.isValidObjectId(eventId)) return null;
  return Event.findById(eventId);
}

async function upsertAttendance(req, res, userId) {
  const event = await loadEvent(req.params.eventId);
  if (!event) {
    return sendError(res, 404, "eventNotFound", "event not found");
  }
  if (event.status === "cancelled") {
    return sendError(res, 409, "eventCancelled", "event is cancelled");
  }
  if (req.user.role !== "admin" && String(userId) !== String(req.user._id)) {
    return sendError(res, 403, "forbidden", "cannot update another user's attendance");
  }
  if (!mongoose.isValidObjectId(userId)) {
    return sendError(res, 404, "userNotFound", "user not found");
  }

  const { status, guests, note } = req.body || {};
  let attendance = await Attendance.findOne({ eventId: event._id, userId });
  const guestsForCapacity =
    status === "yes" ? (guests !== undefined ? guests : attendance?.guests || 0) : 0;
  const exceeds = await Attendance.wouldExceedCapacity(event._id, event.capacity, {
    status,
    guests: guestsForCapacity,
    excludeId: attendance?._id,
  });
  if (exceeds) {
    return sendError(res, 409, "capacityExceeded", "capacity exceeded");
  }

  if (!attendance) {
    attendance = new Attendance({
      eventId: event._id,
      userId,
      status,
      guests,
      note,
    });
  } else {
    attendance.status = status;
    if (guests !== undefined) attendance.guests = guests;
    if (note !== undefined) attendance.note = note;
  }
  await attendance.save();
  res.json(attendance.toJSON());
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.eventId);
    if (!event) {
      return sendError(res, 404, "eventNotFound", "event not found");
    }
    const rows = await Attendance.find({ eventId: event._id });
    res.json(rows.map((row) => row.toJSON()));
  })
);

router.put(
  "/me",
  asyncHandler(async (req, res) => {
    return upsertAttendance(req, res, req.user._id);
  })
);

router.put(
  "/:userId",
  asyncHandler(async (req, res) => {
    return upsertAttendance(req, res, req.params.userId);
  })
);

module.exports = router;
