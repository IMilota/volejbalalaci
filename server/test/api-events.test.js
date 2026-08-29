const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const Event = require("../models/event");
const Attendance = require("../models/attendance");
const { createSession, bearer } = require("./helpers/http");

function isoFromNow(hours) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

describe("events", () => {
  let app;
  before(async () => {
    await connectTestDb();
    await User.syncIndexes();
    await Event.syncIndexes();
    await Attendance.syncIndexes();
    ({ app } = require("../app"));
  });
  after(disconnectTestDb);
  beforeEach(resetTestDb);

  async function makeAdmin() {
    const admin = await User.create({
      name: "A",
      nickname: "adm",
      email: "adm@x.cz",
      role: "admin",
    });
    return { admin, token: await createSession(admin) };
  }

  async function makeUser() {
    const user = await User.create({
      name: "U",
      nickname: "usr",
      email: "usr@x.cz",
      role: "user",
    });
    return { user, token: await createSession(user) };
  }

  function eventBody(overrides = {}) {
    return {
      name: "Úterý",
      startAt: isoFromNow(24),
      endAt: isoFromNow(26),
      location: "Hala",
      capacity: 12,
      ...overrides,
    };
  }

  it("GET /api/events returns 401 without a token", async () => {
    const res = await request(app).get("/api/events");
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "unauthorized");
  });

  it("non-admin POST /api/events returns 403", async () => {
    const { token } = await makeUser();
    const res = await request(app).post("/api/events").set(bearer(token)).send(eventBody());
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "forbidden");
  });

  it("admin POST returns id and occupied 0", async () => {
    const { token } = await makeAdmin();
    const res = await request(app).post("/api/events").set(bearer(token)).send(eventBody());
    assert.equal(res.status, 200);
    assert.ok(res.body.id);
    assert.equal(res.body.occupied, 0);
    assert.equal(res.body.name, "Úterý");
    assert.equal(res.body.status, "scheduled");
    assert.equal(res.body.reminderSentAt, undefined);
  });

  it("GET default excludes past startAt and includes cancelled future events", async () => {
    const { token } = await makeAdmin();
    await Event.create({
      name: "Past",
      startAt: new Date(Date.now() - 48 * 3600 * 1000),
      endAt: new Date(Date.now() - 46 * 3600 * 1000),
      location: "Hala",
      capacity: 8,
    });
    const future = await Event.create({
      name: "Future",
      startAt: new Date(Date.now() + 24 * 3600 * 1000),
      endAt: new Date(Date.now() + 26 * 3600 * 1000),
      location: "Hala",
      capacity: 8,
    });
    const cancelled = await Event.create({
      name: "Cancelled",
      startAt: new Date(Date.now() + 48 * 3600 * 1000),
      endAt: new Date(Date.now() + 50 * 3600 * 1000),
      location: "Hala",
      capacity: 8,
      status: "cancelled",
    });
    const res = await request(app).get("/api/events").set(bearer(token));
    assert.equal(res.status, 200);
    const ids = res.body.map((e) => e.id);
    assert.equal(ids.includes(String(future._id)), true);
    assert.equal(ids.includes(String(cancelled._id)), true);
    assert.equal(res.body.every((e) => typeof e.occupied === "number"), true);
    assert.equal(
      res.body.some((e) => new Date(e.startAt).getTime() < Date.now()),
      false
    );
  });

  it("GET /api/events?from&to filters by startAt range including past", async () => {
    const { token } = await makeAdmin();
    const past = await Event.create({
      name: "Past",
      startAt: new Date("2026-01-01T17:00:00.000Z"),
      endAt: new Date("2026-01-01T19:00:00.000Z"),
      location: "Hala",
      capacity: 8,
    });
    await Event.create({
      name: "Far",
      startAt: new Date("2027-01-01T17:00:00.000Z"),
      endAt: new Date("2027-01-01T19:00:00.000Z"),
      location: "Hala",
      capacity: 8,
    });
    const res = await request(app)
      .get("/api/events")
      .query({ from: "2026-01-01T00:00:00.000Z", to: "2026-06-01T00:00:00.000Z" })
      .set(bearer(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, String(past._id));
  });

  it("GET /api/events/:id returns event plus occupied", async () => {
    const { token } = await makeAdmin();
    const event = await Event.create({
      name: "One",
      startAt: new Date(Date.now() + 24 * 3600 * 1000),
      endAt: new Date(Date.now() + 26 * 3600 * 1000),
      location: "Hala",
      capacity: 12,
    });
    const res = await request(app).get(`/api/events/${event.id}`).set(bearer(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.id, String(event._id));
    assert.equal(res.body.occupied, 0);
    assert.equal(res.body.attendanceList, undefined);
  });

  it("GET unknown event returns 404 eventNotFound", async () => {
    const { token } = await makeAdmin();
    const res = await request(app)
      .get("/api/events/000000000000000000000000")
      .set(bearer(token));
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "eventNotFound");
  });

  it("bulk with empty occurrences is 400", async () => {
    const { token } = await makeAdmin();
    const res = await request(app)
      .post("/api/events/bulk")
      .set(bearer(token))
      .send({
        name: "Series",
        location: "Hala",
        capacity: 10,
        occurrences: [],
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "dtoInIsNotValid");
  });

  it("admin bulk creates one event per occurrence", async () => {
    const { token } = await makeAdmin();
    const res = await request(app)
      .post("/api/events/bulk")
      .set(bearer(token))
      .send({
        name: "Series",
        location: "Hala",
        capacity: 10,
        description: "weekly",
        occurrences: [
          { startAt: isoFromNow(24), endAt: isoFromNow(26) },
          { startAt: isoFromNow(48), endAt: isoFromNow(50) },
        ],
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].name, "Series");
    assert.equal(res.body[0].occupied, 0);
    assert.equal(await Event.countDocuments(), 2);
  });

  it("PATCH allowlist updates fields and ignores status and reminderSentAt", async () => {
    const { token } = await makeAdmin();
    const event = await Event.create({
      name: "Old",
      startAt: new Date(Date.now() + 24 * 3600 * 1000),
      endAt: new Date(Date.now() + 26 * 3600 * 1000),
      location: "Hala",
      capacity: 8,
      description: "d",
    });
    const res = await request(app)
      .patch(`/api/events/${event.id}`)
      .set(bearer(token))
      .send({
        name: "New",
        location: "Jinde",
        capacity: 10,
        description: "updated",
        status: "cancelled",
        reminderSentAt: "2026-01-01T00:00:00.000Z",
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "New");
    assert.equal(res.body.location, "Jinde");
    assert.equal(res.body.capacity, 10);
    assert.equal(res.body.description, "updated");
    assert.equal(res.body.status, "scheduled");
    assert.equal(res.body.reminderSentAt, undefined);
  });

  it("returns occupied and cancel sets cancelled", async () => {
    const { admin, token } = await makeAdmin();
    const event = await Event.create({
      name: "Game",
      startAt: new Date(Date.now() + 24 * 3600 * 1000),
      endAt: new Date(Date.now() + 26 * 3600 * 1000),
      location: "Hala",
      capacity: 12,
    });
    await Attendance.create({
      eventId: event._id,
      userId: admin._id,
      status: "yes",
      guests: 2,
    });
    const before = await request(app).get(`/api/events/${event.id}`).set(bearer(token));
    assert.equal(before.status, 200);
    assert.equal(before.body.occupied, 3);
    const cancelled = await request(app)
      .post(`/api/events/${event.id}/cancel`)
      .set(bearer(token));
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, "cancelled");
    assert.equal(cancelled.body.occupied, 3);
  });
});
