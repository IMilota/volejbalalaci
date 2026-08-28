const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const Event = require("../models/event");
const Attendance = require("../models/attendance");

describe("Attendance", () => {
  let userA;
  let userB;
  let event;

  before(async () => {
    await connectTestDb();
    await User.syncIndexes();
    await Event.syncIndexes();
    await Attendance.syncIndexes();
  });
  after(disconnectTestDb);
  beforeEach(async () => {
    await resetTestDb();
    userA = await User.create({ name: "A", nickname: "a", email: "a@x.cz" });
    userB = await User.create({ name: "B", nickname: "b", email: "b@x.cz" });
    event = await Event.create({
      name: "E",
      startAt: new Date("2026-09-01T17:00:00.000Z"),
      endAt: new Date("2026-09-01T19:00:00.000Z"),
      location: "Hala",
      capacity: 3,
    });
  });

  it("zeros guests for no/maybe and counts occupancy only for yes", async () => {
    await Attendance.create({
      eventId: event._id,
      userId: userA._id,
      status: "no",
      guests: 4,
      note: "maybe later",
    });
    const noRow = await Attendance.findOne({ userId: userA._id });
    assert.equal(noRow.guests, 0);

    await Attendance.create({
      eventId: event._id,
      userId: userB._id,
      status: "yes",
      guests: 1,
    });
    assert.equal(await Attendance.occupiedSeats(event._id), 2);
  });

  it("rejects a second attendance for the same user and event", async () => {
    await Attendance.create({
      eventId: event._id,
      userId: userA._id,
      status: "maybe",
    });
    await assert.rejects(
      () =>
        Attendance.create({
          eventId: event._id,
          userId: userA._id,
          status: "yes",
        }),
      { name: "MongoServerError" }
    );
  });

  it("wouldExceedCapacity is true when yes+guests would pass event.capacity", async () => {
    await Attendance.create({
      eventId: event._id,
      userId: userA._id,
      status: "yes",
      guests: 1,
    });
    const over = await Attendance.wouldExceedCapacity(event._id, event.capacity, {
      status: "yes",
      guests: 1,
    });
    assert.equal(over, true);
    const ok = await Attendance.wouldExceedCapacity(event._id, event.capacity, {
      status: "yes",
      guests: 0,
    });
    assert.equal(ok, false);
  });

  it("rejects note longer than 280 characters", async () => {
    await assert.rejects(
      () =>
        Attendance.create({
          eventId: event._id,
          userId: userA._id,
          status: "yes",
          note: "x".repeat(281),
        }),
      { name: "ValidationError" }
    );
  });
});
