const express = require("express");
const mongoose = require("mongoose");
const { sendError } = require("../http/errors");
const { asyncHandler } = require("../http/asyncHandler");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const Event = require("../models/event");
const Attendance = require("../models/attendance");

const router = express.Router();
const EVENT_PATCH_FIELDS = ["name", "startAt", "endAt", "location", "capacity", "description"];

router.use(requireAuth);

async function withOccupied(event) {
  return { ...event.toJSON(), occupied: await Attendance.occupiedSeats(event._id) };
}

async function withOccupiedAndMine(events, userId) {
  const mine = await Attendance.find({
    userId,
    eventId: { $in: events.map((event) => event._id) },
  }).lean();
  const statusByEvent = new Map(mine.map((row) => [String(row.eventId), row.status]));
  return Promise.all(
    events.map(async (event) => ({
      ...(await withOccupied(event)),
      myStatus: statusByEvent.get(String(event._id)) ?? null,
    }))
  );
}

async function withOccupiedAndMineOne(event, userId) {
  const [row] = await withOccupiedAndMine([event], userId);
  return row;
}

function parseQueryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error("invalid date");
    err.name = "CastError";
    throw err;
  }
  return date;
}

function startAtQuery(query) {
  if (query.from || query.to) {
    const startAt = {};
    if (query.from) startAt.$gte = parseQueryDate(query.from);
    if (query.to) startAt.$lte = parseQueryDate(query.to);
    return { startAt };
  }
  return { startAt: { $gte: new Date() } };
}

async function loadEvent(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Event.findById(id);
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const events = await Event.find(startAtQuery(req.query)).sort({ startAt: 1 });
    res.json(await withOccupiedAndMine(events, req.user._id));
  })
);

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, startAt, endAt, location, capacity, description } = req.body || {};
    const event = await Event.create({ name, startAt, endAt, location, capacity, description });
    res.json(await withOccupied(event));
  })
);

router.post(
  "/bulk",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const occurrences = req.body?.occurrences;
    if (!Array.isArray(occurrences) || occurrences.length < 1) {
      return sendError(res, 400, "dtoInIsNotValid", "occurrences must be a non-empty array");
    }
    const { name, location, capacity, description } = req.body;
    const created = await Event.create(
      occurrences.map((occurrence) => ({
        name,
        location,
        capacity,
        description,
        startAt: occurrence.startAt,
        endAt: occurrence.endAt,
      }))
    );
    res.json(await Promise.all(created.map(withOccupied)));
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.id);
    if (!event) {
      return sendError(res, 404, "eventNotFound", "event not found");
    }
    res.json(await withOccupiedAndMineOne(event, req.user._id));
  })
);

router.patch(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.id);
    if (!event) {
      return sendError(res, 404, "eventNotFound", "event not found");
    }
    const body = req.body || {};
    for (const field of EVENT_PATCH_FIELDS) {
      if (body[field] !== undefined) {
        event[field] = body[field];
      }
    }
    await event.save();
    res.json(await withOccupiedAndMineOne(event, req.user._id));
  })
);

router.post(
  "/:id/cancel",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.id);
    if (!event) {
      return sendError(res, 404, "eventNotFound", "event not found");
    }
    event.status = "cancelled";
    await event.save();
    res.json(await withOccupiedAndMineOne(event, req.user._id));
  })
);

module.exports = router;
