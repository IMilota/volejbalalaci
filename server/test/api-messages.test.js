const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const Event = require("../models/event");
const Message = require("../models/message");
const { createSession, bearer } = require("./helpers/http");

describe("messages", () => {
  let app;
  before(async () => {
    await connectTestDb();
    await User.syncIndexes();
    await Event.syncIndexes();
    await Message.syncIndexes();
    ({ app } = require("../app"));
  });
  after(disconnectTestDb);
  beforeEach(resetTestDb);

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

  it("GET /api/messages returns 401 without a token", async () => {
    const res = await request(app).get("/api/messages");
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "unauthorized");
  });

  it("GET without eventId returns only board messages (eventId null)", async () => {
    const { user, token } = await makeUser();
    const event = await makeEvent();
    await Message.create({ eventId: null, authorId: user._id, body: "board" });
    await Message.create({ eventId: event._id, authorId: user._id, body: "event" });
    const res = await request(app).get("/api/messages").set(bearer(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].body, "board");
    assert.equal(res.body[0].eventId, null);
    assert.ok(res.body[0].id);
  });

  it("GET with invalid eventId returns 400 dtoInIsNotValid", async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .get("/api/messages")
      .query({ eventId: "not-an-id" })
      .set(bearer(token));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "dtoInIsNotValid");
  });

  it("GET ?eventId= returns that event's messages sorted by createdAt", async () => {
    const { user, token } = await makeUser();
    const event = await makeEvent();
    await Message.create({ eventId: event._id, authorId: user._id, body: "first" });
    await Message.create({ eventId: event._id, authorId: user._id, body: "second" });
    await Message.create({ eventId: null, authorId: user._id, body: "board" });
    const res = await request(app)
      .get("/api/messages")
      .query({ eventId: event.id })
      .set(bearer(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].body, "first");
    assert.equal(res.body[1].body, "second");
    assert.equal(res.body[0].eventId, String(event._id));
  });

  it("POST without eventId stores a board message with eventId null", async () => {
    const { user, token } = await makeUser();
    const res = await request(app)
      .post("/api/messages")
      .set(bearer(token))
      .send({ body: "hello board" });
    assert.equal(res.status, 200);
    assert.equal(res.body.body, "hello board");
    assert.equal(res.body.eventId, null);
    assert.equal(res.body.authorId, String(user._id));
    const stored = await Message.findById(res.body.id).lean();
    assert.equal(stored.eventId, null);
  });

  it("POST with replyToId creates a reply; reply-to-reply returns 400", async () => {
    const { user, token } = await makeUser();
    const root = await Message.create({
      eventId: null,
      authorId: user._id,
      body: "root",
    });
    const reply = await request(app)
      .post("/api/messages")
      .set(bearer(token))
      .send({ body: "reply", replyToId: root.id });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.body, "reply");
    assert.equal(reply.body.replyToId, String(root._id));
    assert.equal(reply.body.eventId, null);

    const nested = await request(app)
      .post("/api/messages")
      .set(bearer(token))
      .send({ body: "nested", replyToId: reply.body.id });
    assert.equal(nested.status, 400);
    assert.equal(nested.body.code, "dtoInIsNotValid");
  });

  it("non-author cannot PATCH another user's message", async () => {
    const { user } = await makeUser();
    const { token: otherToken } = await makeUser({
      nickname: "other",
      email: "other@x.cz",
    });
    const msg = await Message.create({
      eventId: null,
      authorId: user._id,
      body: "mine",
    });
    const res = await request(app)
      .patch(`/api/messages/${msg.id}`)
      .set(bearer(otherToken))
      .send({ body: "hijacked" });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "forbidden");
    const stored = await Message.findById(msg._id);
    assert.equal(stored.body, "mine");
  });

  it("author can PATCH body; admin can PATCH any message", async () => {
    const { user, token } = await makeUser();
    const { token: adminToken } = await makeAdmin();
    const msg = await Message.create({
      eventId: null,
      authorId: user._id,
      body: "draft",
    });
    const byAuthor = await request(app)
      .patch(`/api/messages/${msg.id}`)
      .set(bearer(token))
      .send({ body: "edited" });
    assert.equal(byAuthor.status, 200);
    assert.equal(byAuthor.body.body, "edited");

    const byAdmin = await request(app)
      .patch(`/api/messages/${msg.id}`)
      .set(bearer(adminToken))
      .send({ body: "admin edit" });
    assert.equal(byAdmin.status, 200);
    assert.equal(byAdmin.body.body, "admin edit");
  });

  it("DELETE by author uses deleteWithReplies; non-author gets 403", async () => {
    const { user, token } = await makeUser();
    const { token: otherToken } = await makeUser({
      nickname: "other",
      email: "other@x.cz",
    });
    const root = await Message.create({
      eventId: null,
      authorId: user._id,
      body: "root",
    });
    await Message.createReply(root._id, { authorId: user._id, body: "reply" });

    const forbidden = await request(app)
      .delete(`/api/messages/${root.id}`)
      .set(bearer(otherToken));
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "forbidden");
    assert.equal(await Message.countDocuments(), 2);

    const deleted = await request(app)
      .delete(`/api/messages/${root.id}`)
      .set(bearer(token));
    assert.equal(deleted.status, 200);
    assert.equal(await Message.countDocuments(), 0);
  });

  it("PATCH unknown message returns 404 messageNotFound", async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .patch("/api/messages/000000000000000000000000")
      .set(bearer(token))
      .send({ body: "nope" });
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "messageNotFound");
  });
});
