const express = require("express");
const mongoose = require("mongoose");
const { sendError } = require("../http/errors");
const { asyncHandler } = require("../http/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const Event = require("../models/event");
const Ride = require("../models/ride");

const eventRidesRouter = express.Router({ mergeParams: true });
const ridesRouter = express.Router();
const RIDE_PATCH_FIELDS = ["from", "to", "seats", "departAt", "note"];

function requireRidesEnabled(req, res, next) {
  if (process.env.FEATURE_RIDES !== "true") {
    return sendError(res, 404, "ridesDisabled", "rides disabled");
  }
  next();
}

eventRidesRouter.use(requireAuth, requireRidesEnabled);
ridesRouter.use(requireAuth, requireRidesEnabled);

function canManageRide(user, ride) {
  return user.role === "admin" || String(user._id) === String(ride.driverId);
}

async function loadEvent(eventId) {
  if (!mongoose.isValidObjectId(eventId)) return null;
  return Event.findById(eventId);
}

async function loadRide(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Ride.findById(id);
}

async function assertEventWritable(eventId, res) {
  const event = await loadEvent(eventId);
  if (!event) {
    sendError(res, 404, "eventNotFound", "event not found");
    return null;
  }
  if (event.status === "cancelled") {
    sendError(res, 409, "eventCancelled", "event is cancelled");
    return null;
  }
  return event;
}

eventRidesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.eventId);
    if (!event) {
      return sendError(res, 404, "eventNotFound", "event not found");
    }
    const rides = await Ride.find({ eventId: event._id });
    res.json(rides.map((ride) => ride.toJSON()));
  })
);

eventRidesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const event = await assertEventWritable(req.params.eventId, res);
    if (!event) return;
    const { from, to, seats, departAt, note } = req.body || {};
    try {
      const ride = await Ride.create({
        eventId: event._id,
        driverId: req.user._id,
        from,
        to,
        seats,
        departAt,
        note,
      });
      res.json(ride.toJSON());
    } catch (err) {
      if (err.code === 11000) {
        return sendError(res, 409, "rideAlreadyOffered", "ride already offered");
      }
      throw err;
    }
  })
);

ridesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const ride = await loadRide(req.params.id);
    if (!ride) {
      return sendError(res, 404, "rideNotFound", "ride not found");
    }
    if (!(await assertEventWritable(ride.eventId, res))) return;
    if (!canManageRide(req.user, ride)) {
      return sendError(res, 403, "forbidden", "cannot update this ride");
    }
    const body = req.body || {};
    for (const field of RIDE_PATCH_FIELDS) {
      if (body[field] !== undefined) {
        ride[field] = body[field];
      }
    }
    await ride.save();
    res.json(ride.toJSON());
  })
);

ridesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const ride = await loadRide(req.params.id);
    if (!ride) {
      return sendError(res, 404, "rideNotFound", "ride not found");
    }
    if (!(await assertEventWritable(ride.eventId, res))) return;
    if (!canManageRide(req.user, ride)) {
      return sendError(res, 403, "forbidden", "cannot delete this ride");
    }
    await ride.deleteOne();
    res.json({ ok: true });
  })
);

ridesRouter.post(
  "/:id/join",
  asyncHandler(async (req, res) => {
    const ride = await loadRide(req.params.id);
    if (!ride) {
      return sendError(res, 404, "rideNotFound", "ride not found");
    }
    if (!(await assertEventWritable(ride.eventId, res))) return;
    if (String(ride.driverId) === String(req.user._id)) {
      return sendError(res, 403, "forbidden", "driver cannot join their own ride");
    }
    if (ride.passengerIds.length >= ride.seats) {
      return sendError(res, 409, "rideFull", "ride is full");
    }
    ride.passengerIds.push(req.user._id);
    await ride.save();
    res.json(ride.toJSON());
  })
);

ridesRouter.post(
  "/:id/leave",
  asyncHandler(async (req, res) => {
    const ride = await loadRide(req.params.id);
    if (!ride) {
      return sendError(res, 404, "rideNotFound", "ride not found");
    }
    if (!(await assertEventWritable(ride.eventId, res))) return;
    ride.passengerIds = ride.passengerIds.filter(
      (id) => String(id) !== String(req.user._id)
    );
    await ride.save();
    res.json(ride.toJSON());
  })
);

module.exports = { eventRidesRouter, ridesRouter };
