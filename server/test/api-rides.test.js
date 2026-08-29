const { describe, it, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const Event = require("../models/event");
const Ride = require("../models/ride");
const { createSession, bearer } = require("./helpers/http");

describe("rides", () => {
  let app;
  let previousFeatureRides;

  before(async () => {
    await connectTestDb();
    await User.syncIndexes();
    await Event.syncIndexes();
    await Ride.syncIndexes();
    ({ app } = require("../app"));
  });
  after(disconnectTestDb);
  beforeEach(async () => {
    previousFeatureRides = process.env.FEATURE_RIDES;
    process.env.FEATURE_RIDES = "true";
    await resetTestDb();
  });
  afterEach(() => {
    if (previousFeatureRides === undefined) {
      delete process.env.FEATURE_RIDES;
    } else {
      process.env.FEATURE_RIDES = previousFeatureRides;
    }
  });

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

  async function makeAdmin() {
    const admin = await User.create({
      name: "A",
      nickname: "adm",
      email: "adm@x.cz",
      role: "admin",
    });
    return { admin, token: await createSession(admin) };
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

  function rideBody(overrides = {}) {
    return {
      from: "Dejvice",
      to: "Hala",
      seats: 3,
      departAt: new Date(Date.now() + 23 * 3600 * 1000).toISOString(),
      note: "front door",
      ...overrides,
    };
  }

  it("GET rides returns 404 ridesDisabled when FEATURE_RIDES is not true", async () => {
    process.env.FEATURE_RIDES = "false";
    const { token } = await makeUser();
    const event = await makeEvent();
    const res = await request(app)
      .get(`/api/events/${event.id}/rides`)
      .set(bearer(token));
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "ridesDisabled");
  });

  it("GET /api/events/:eventId/rides lists rides for the event", async () => {
    const { user, token } = await makeUser();
    const event = await makeEvent();
    await Ride.create({
      eventId: event._id,
      driverId: user._id,
      from: "A",
      to: "B",
      seats: 2,
      departAt: new Date(Date.now() + 23 * 3600 * 1000),
    });
    const res = await request(app)
      .get(`/api/events/${event.id}/rides`)
      .set(bearer(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].from, "A");
    assert.equal(res.body[0].driverId, String(user._id));
    assert.ok(res.body[0].id);
  });

  it("POST creates a ride for the caller as driver", async () => {
    const { user, token } = await makeUser();
    const event = await makeEvent();
    const res = await request(app)
      .post(`/api/events/${event.id}/rides`)
      .set(bearer(token))
      .send(rideBody());
    assert.equal(res.status, 200);
    assert.equal(res.body.from, "Dejvice");
    assert.equal(res.body.to, "Hala");
    assert.equal(res.body.seats, 3);
    assert.equal(res.body.driverId, String(user._id));
    assert.equal(res.body.eventId, String(event._id));
    assert.deepEqual(res.body.passengerIds, []);
  });

  it("POST second offer by the same driver returns 409 rideAlreadyOffered", async () => {
    const { user, token } = await makeUser();
    const event = await makeEvent();
    await Ride.create({
      eventId: event._id,
      driverId: user._id,
      from: "A",
      to: "B",
      seats: 2,
      departAt: new Date(Date.now() + 23 * 3600 * 1000),
    });
    const res = await request(app)
      .post(`/api/events/${event.id}/rides`)
      .set(bearer(token))
      .send(rideBody());
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "rideAlreadyOffered");
  });

  it("POST on a cancelled event returns 409 eventCancelled", async () => {
    const { token } = await makeUser();
    const event = await makeEvent({ status: "cancelled" });
    const res = await request(app)
      .post(`/api/events/${event.id}/rides`)
      .set(bearer(token))
      .send(rideBody());
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "eventCancelled");
  });

  it("join when seats=1 and one passenger already returns 409 rideFull", async () => {
    const { user: driver } = await makeUser();
    const passenger = await User.create({
      name: "P",
      nickname: "pass",
      email: "pass@x.cz",
    });
    const { token: joinerToken } = await makeUser({
      nickname: "join",
      email: "join@x.cz",
    });
    const event = await makeEvent();
    const ride = await Ride.create({
      eventId: event._id,
      driverId: driver._id,
      from: "A",
      to: "B",
      seats: 1,
      departAt: new Date(Date.now() + 23 * 3600 * 1000),
      passengerIds: [passenger._id],
    });
    const res = await request(app)
      .post(`/api/rides/${ride.id}/join`)
      .set(bearer(joinerToken));
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "rideFull");
    const stored = await Ride.findById(ride._id);
    assert.equal(stored.passengerIds.length, 1);
  });

  it("join pushes the caller onto passengerIds", async () => {
    const { user: driver } = await makeUser();
    const { user: joiner, token: joinerToken } = await makeUser({
      nickname: "join",
      email: "join@x.cz",
    });
    const event = await makeEvent();
    const ride = await Ride.create({
      eventId: event._id,
      driverId: driver._id,
      from: "A",
      to: "B",
      seats: 2,
      departAt: new Date(Date.now() + 23 * 3600 * 1000),
    });
    const res = await request(app)
      .post(`/api/rides/${ride.id}/join`)
      .set(bearer(joinerToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.passengerIds.length, 1);
    assert.equal(res.body.passengerIds[0], String(joiner._id));
  });

  it("join on a cancelled event returns 409 eventCancelled", async () => {
    const { user: driver } = await makeUser();
    const { token: joinerToken } = await makeUser({
      nickname: "join",
      email: "join@x.cz",
    });
    const event = await makeEvent({ status: "cancelled" });
    const ride = await Ride.create({
      eventId: event._id,
      driverId: driver._id,
      from: "A",
      to: "B",
      seats: 2,
      departAt: new Date(Date.now() + 23 * 3600 * 1000),
    });
    const res = await request(app)
      .post(`/api/rides/${ride.id}/join`)
      .set(bearer(joinerToken));
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "eventCancelled");
  });

  it("leave removes the caller from passengerIds", async () => {
    const { user: driver } = await makeUser();
    const { user: joiner, token: joinerToken } = await makeUser({
      nickname: "join",
      email: "join@x.cz",
    });
    const event = await makeEvent();
    const ride = await Ride.create({
      eventId: event._id,
      driverId: driver._id,
      from: "A",
      to: "B",
      seats: 2,
      departAt: new Date(Date.now() + 23 * 3600 * 1000),
      passengerIds: [joiner._id],
    });
    const res = await request(app)
      .post(`/api/rides/${ride.id}/leave`)
      .set(bearer(joinerToken));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.passengerIds, []);
  });

  it("non-driver cannot PATCH; driver can; admin can DELETE", async () => {
    const { user: driver, token: driverToken } = await makeUser();
    const { token: otherToken } = await makeUser({
      nickname: "other",
      email: "other@x.cz",
    });
    const { token: adminToken } = await makeAdmin();
    const event = await makeEvent();
    const ride = await Ride.create({
      eventId: event._id,
      driverId: driver._id,
      from: "A",
      to: "B",
      seats: 2,
      departAt: new Date(Date.now() + 23 * 3600 * 1000),
    });
    const forbidden = await request(app)
      .patch(`/api/rides/${ride.id}`)
      .set(bearer(otherToken))
      .send({ from: "X" });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "forbidden");

    const patched = await request(app)
      .patch(`/api/rides/${ride.id}`)
      .set(bearer(driverToken))
      .send({ from: "Letná", note: "gate 2" });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.from, "Letná");
    assert.equal(patched.body.note, "gate 2");
    assert.equal(patched.body.to, "B");

    const deleted = await request(app)
      .delete(`/api/rides/${ride.id}`)
      .set(bearer(adminToken));
    assert.equal(deleted.status, 200);
    assert.equal(await Ride.countDocuments(), 0);
  });

  it("GET unknown ride join returns 404 rideNotFound", async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post("/api/rides/000000000000000000000000/join")
      .set(bearer(token));
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "rideNotFound");
  });

  it("POST unknown event returns 404 eventNotFound", async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post("/api/events/000000000000000000000000/rides")
      .set(bearer(token))
      .send(rideBody());
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "eventNotFound");
  });
});
