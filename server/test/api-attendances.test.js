const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const Event = require("../models/event");
const Attendance = require("../models/attendance");
const { createSession, bearer } = require("./helpers/http");

describe("attendances", () => {
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

  async function makeUser(overrides = {}) {
    const user = await User.create({
      name: "U",
      nickname: "usr",
      email: "usr@x.cz",
      role: "user",
      ...overrides,
    });
    return { user, token: await createSession(user) };
  }

  async function makeEvent(overrides = {}) {
    return Event.create({
      name: "Úterý",
      startAt: new Date(Date.now() + 24 * 3600 * 1000),
      endAt: new Date(Date.now() + 26 * 3600 * 1000),
      location: "Hala",
      capacity: 12,
      ...overrides,
    });
  }

  function path(eventId, suffix) {
    return `/api/events/${eventId}/attendances/${suffix}`;
  }

  it("GET /api/events/:eventId/attendances returns 401 without a token", async () => {
    const event = await makeEvent();
    const res = await request(app).get(`/api/events/${event.id}/attendances`);
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "unauthorized");
  });

  it("GET lists attendances for the event", async () => {
    const { user, token } = await makeUser();
    const event = await makeEvent();
    await Attendance.create({
      eventId: event._id,
      userId: user._id,
      status: "yes",
      guests: 1,
      note: "bringing a friend",
    });
    const res = await request(app)
      .get(`/api/events/${event.id}/attendances`)
      .set(bearer(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].userId, String(user._id));
    assert.equal(res.body[0].eventId, String(event._id));
    assert.equal(res.body[0].status, "yes");
    assert.equal(res.body[0].guests, 1);
    assert.ok(res.body[0].id);
  });

  it("PUT /me upserts the caller's attendance", async () => {
    const { user, token } = await makeUser();
    const event = await makeEvent();
    const created = await request(app)
      .put(path(event.id, "me"))
      .set(bearer(token))
      .send({ status: "yes", guests: 2, note: "car" });
    assert.equal(created.status, 200);
    assert.equal(created.body.status, "yes");
    assert.equal(created.body.guests, 2);
    assert.equal(created.body.note, "car");
    assert.equal(created.body.userId, String(user._id));

    const updated = await request(app)
      .put(path(event.id, "me"))
      .set(bearer(token))
      .send({ status: "no", note: "sick" });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, "no");
    assert.equal(updated.body.guests, 0);
    assert.equal(updated.body.note, "sick");
    assert.equal(await Attendance.countDocuments({ eventId: event._id, userId: user._id }), 1);
  });

  it("user cannot PUT another user's attendance", async () => {
    const { token } = await makeUser();
    const other = await User.create({
      name: "O",
      nickname: "other",
      email: "other@x.cz",
      role: "user",
    });
    const event = await makeEvent();
    const res = await request(app)
      .put(path(event.id, other.id))
      .set(bearer(token))
      .send({ status: "yes" });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "forbidden");
    assert.equal(await Attendance.countDocuments(), 0);
  });

  it("admin PUT for a well-formed ObjectId that is not a user returns 404 userNotFound", async () => {
    const { token } = await makeAdmin();
    const event = await makeEvent();
    const missingUserId = "000000000000000000000001";
    const res = await request(app)
      .put(path(event.id, missingUserId))
      .set(bearer(token))
      .send({ status: "yes" });
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "userNotFound");
    assert.equal(await Attendance.countDocuments(), 0);
  });

  it("admin can PUT another user's attendance", async () => {
    const { token } = await makeAdmin();
    const { user } = await makeUser();
    const event = await makeEvent();
    const res = await request(app)
      .put(path(event.id, user.id))
      .set(bearer(token))
      .send({ status: "yes", guests: 1 });
    assert.equal(res.status, 200);
    assert.equal(res.body.userId, String(user._id));
    assert.equal(res.body.status, "yes");
    assert.equal(res.body.guests, 1);
  });

  it("yes that exceeds capacity returns 409 capacityExceeded", async () => {
    const { user, token } = await makeUser();
    const other = await User.create({
      name: "O",
      nickname: "other",
      email: "other@x.cz",
    });
    const event = await makeEvent({ capacity: 2 });
    await Attendance.create({
      eventId: event._id,
      userId: other._id,
      status: "yes",
      guests: 1,
    });
    const res = await request(app)
      .put(path(event.id, "me"))
      .set(bearer(token))
      .send({ status: "yes" });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "capacityExceeded");
    assert.equal(await Attendance.countDocuments({ userId: user._id }), 0);
  });

  it("updating own yes does not count the existing row against capacity", async () => {
    const { user, token } = await makeUser();
    const event = await makeEvent({ capacity: 1 });
    await Attendance.create({
      eventId: event._id,
      userId: user._id,
      status: "yes",
      guests: 0,
    });
    const res = await request(app)
      .put(path(event.id, "me"))
      .set(bearer(token))
      .send({ status: "yes", note: "still in" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "yes");
    assert.equal(res.body.note, "still in");
  });

  it("PUT on a cancelled event returns 409 eventCancelled", async () => {
    const { token } = await makeUser();
    const event = await makeEvent({ status: "cancelled" });
    const res = await request(app)
      .put(path(event.id, "me"))
      .set(bearer(token))
      .send({ status: "yes" });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "eventCancelled");
  });

  it("PUT unknown event returns 404 eventNotFound", async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .put(path("000000000000000000000000", "me"))
      .set(bearer(token))
      .send({ status: "yes" });
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "eventNotFound");
  });

  it("guests are ignored and zeroed for maybe", async () => {
    const { token } = await makeUser();
    const filler = await User.create({
      name: "F",
      nickname: "fill",
      email: "fill@x.cz",
    });
    const event = await makeEvent({ capacity: 1 });
    await Attendance.create({
      eventId: event._id,
      userId: filler._id,
      status: "yes",
    });
    const res = await request(app)
      .put(path(event.id, "me"))
      .set(bearer(token))
      .send({ status: "maybe", guests: 4, note: "if I can" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "maybe");
    assert.equal(res.body.guests, 0);
    assert.equal(res.body.note, "if I can");
  });
});
