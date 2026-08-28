const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const Event = require("../models/event");

describe("Event", () => {
  before(async () => {
    await connectTestDb();
    await Event.syncIndexes();
  });
  after(disconnectTestDb);
  beforeEach(resetTestDb);

  it("creates a scheduled event and exposes id", async () => {
    const event = await Event.create({
      name: "Úterý",
      startAt: new Date("2026-09-01T17:00:00.000Z"),
      endAt: new Date("2026-09-01T19:00:00.000Z"),
      location: "Tělocvična ZŠ",
      capacity: 12,
    });
    assert.equal(event.status, "scheduled");
    assert.equal(event.toJSON().id, String(event._id));
  });

  it("rejects endAt before or equal to startAt", async () => {
    const startAt = new Date("2026-09-01T17:00:00.000Z");
    await assert.rejects(
      () =>
        Event.create({
          name: "Bad",
          startAt,
          endAt: startAt,
          location: "X",
          capacity: 8,
        }),
      { name: "ValidationError" }
    );
  });

  it("rejects capacity below 1 and invalid status", async () => {
    const base = {
      name: "X",
      startAt: new Date("2026-09-01T17:00:00.000Z"),
      endAt: new Date("2026-09-01T18:00:00.000Z"),
      location: "X",
    };
    await assert.rejects(() => Event.create({ ...base, capacity: 0 }), {
      name: "ValidationError",
    });
    await assert.rejects(
      () => Event.create({ ...base, capacity: 8, status: "deleted" }),
      { name: "ValidationError" }
    );
  });
});
