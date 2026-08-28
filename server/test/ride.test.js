const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const Event = require("../models/event");
const Ride = require("../models/ride");

describe("Ride", () => {
  let driver;
  let passenger;
  let other;
  let event;

  before(async () => {
    await connectTestDb();
    await Ride.syncIndexes();
  });
  after(disconnectTestDb);
  beforeEach(async () => {
    await resetTestDb();
    driver = await User.create({ name: "D", nickname: "d", email: "d@x.cz" });
    passenger = await User.create({ name: "P", nickname: "p", email: "p@x.cz" });
    other = await User.create({ name: "O", nickname: "o", email: "o@x.cz" });
    event = await Event.create({
      name: "E",
      startAt: new Date("2026-09-01T17:00:00.000Z"),
      endAt: new Date("2026-09-01T19:00:00.000Z"),
      location: "Hala",
      capacity: 12,
    });
  });

  it("rejects driver as passenger, duplicate passengers, and over seats", async () => {
    await assert.rejects(
      () =>
        Ride.create({
          eventId: event._id,
          driverId: driver._id,
          from: "A",
          to: "B",
          seats: 1,
          departAt: new Date("2026-09-01T16:00:00.000Z"),
          passengerIds: [driver._id],
        }),
      { name: "ValidationError" }
    );
    await assert.rejects(
      () =>
        Ride.create({
          eventId: event._id,
          driverId: driver._id,
          from: "A",
          to: "B",
          seats: 1,
          departAt: new Date("2026-09-01T16:00:00.000Z"),
          passengerIds: [passenger._id, passenger._id],
        }),
      { name: "ValidationError" }
    );
    await assert.rejects(
      () =>
        Ride.create({
          eventId: event._id,
          driverId: driver._id,
          from: "A",
          to: "B",
          seats: 1,
          departAt: new Date("2026-09-01T16:00:00.000Z"),
          passengerIds: [passenger._id, other._id],
        }),
      { name: "ValidationError" }
    );
  });

  it("allows one ride per driver per event", async () => {
    await Ride.create({
      eventId: event._id,
      driverId: driver._id,
      from: "A",
      to: "B",
      seats: 2,
      departAt: new Date("2026-09-01T16:00:00.000Z"),
      passengerIds: [passenger._id],
    });
    await assert.rejects(
      () =>
        Ride.create({
          eventId: event._id,
          driverId: driver._id,
          from: "X",
          to: "Y",
          seats: 2,
          departAt: new Date("2026-09-01T16:30:00.000Z"),
        }),
      { name: "MongoServerError" }
    );
  });
});
