const { describe, it, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const webpush = require("web-push");
const cron = require("node-cron");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const { createSession, bearer } = require("./helpers/http");

const vapidKeys = webpush.generateVAPIDKeys();

function setVapid() {
  process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey;
  process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey;
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
}

function unsetVapid() {
  process.env.VAPID_PUBLIC_KEY = "";
  process.env.VAPID_PRIVATE_KEY = "";
  process.env.VAPID_SUBJECT = "";
}

function fakeSub(endpoint) {
  return {
    endpoint,
    keys: { p256dh: "BNcRdreALRPXPKOHDSDfa7qDlHUUvrqbBFA", auth: "tBHItJI5svbpez7KI4CCXg" },
  };
}

describe("push subscriptions", () => {
  let app;
  let sendImpl = async () => {};

  before(async () => {
    mock.method(cron, "schedule", () => ({ start() {}, stop() {} }));
    mock.method(webpush, "sendNotification", (...args) => sendImpl(...args));
    await connectTestDb();
    ({ app } = require("../app"));
  });
  after(async () => {
    await disconnectTestDb();
    mock.restoreAll();
  });
  beforeEach(async () => {
    sendImpl = async () => {};
    webpush.sendNotification.mock.resetCalls();
    setVapid();
    await resetTestDb();
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

  it("does not start reminder cron when the app module is loaded", () => {
    assert.equal(cron.schedule.mock.callCount(), 0);
  });

  it("POST /api/push/subscribe without VAPID returns 503 pushNotConfigured", async () => {
    unsetVapid();
    const { token } = await makeUser();
    const res = await request(app)
      .post("/api/push/subscribe")
      .set(bearer(token))
      .send(fakeSub("https://push.example/no-vapid"));
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "pushNotConfigured");
  });

  it("POST /api/push/subscribe with VAPID returns 200 and stores the subscription", async () => {
    const { user, token } = await makeUser();
    const sub = fakeSub("https://push.example/ok");
    const res = await request(app).post("/api/push/subscribe").set(bearer(token)).send(sub);
    assert.equal(res.status, 200);
    const PushSubscription = require("../models/push-subscription");
    const stored = await PushSubscription.findOne({ endpoint: sub.endpoint }).lean();
    assert.ok(stored);
    assert.equal(String(stored.userId), String(user._id));
    assert.equal(stored.p256dh, sub.keys.p256dh);
    assert.equal(stored.auth, sub.keys.auth);
  });

  it("DELETE /api/push/subscribe removes that user's endpoint", async () => {
    const { token } = await makeUser();
    const sub = fakeSub("https://push.example/del");
    const created = await request(app).post("/api/push/subscribe").set(bearer(token)).send(sub);
    assert.equal(created.status, 200);
    const deleted = await request(app)
      .delete("/api/push/subscribe")
      .set(bearer(token))
      .send({ endpoint: sub.endpoint });
    assert.equal(deleted.status, 200);
    const PushSubscription = require("../models/push-subscription");
    assert.equal(await PushSubscription.countDocuments({ endpoint: sub.endpoint }), 0);
  });

  it("POST /api/messages sends Web Push to others and skips the author", async () => {
    const { user: author, token: authorToken } = await makeUser();
    const { token: otherToken } = await makeUser({ nickname: "other", email: "other@x.cz" });
    const authorSub = fakeSub("https://push.example/author");
    const otherSub = fakeSub("https://push.example/other");
    assert.equal(
      (await request(app).post("/api/push/subscribe").set(bearer(authorToken)).send(authorSub)).status,
      200
    );
    assert.equal(
      (await request(app).post("/api/push/subscribe").set(bearer(otherToken)).send(otherSub)).status,
      200
    );

    const res = await request(app)
      .post("/api/messages")
      .set(bearer(authorToken))
      .send({ body: "hello board" });
    assert.equal(res.status, 200);

    const calls = webpush.sendNotification.mock.calls;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].arguments[0].endpoint, otherSub.endpoint);
    const payload = JSON.parse(calls[0].arguments[1]);
    assert.equal(payload.type, "message");
    assert.equal(payload.messageId, res.body.id);
    assert.equal(payload.eventId, null);
    assert.equal(payload.body, "hello board");
    assert.ok(payload.title);
    assert.equal(String(res.body.authorId), String(author._id));
  });

  it("deletes a subscription when web-push returns 410", async () => {
    sendImpl = async () => {
      const err = new Error("Gone");
      err.statusCode = 410;
      throw err;
    };
    const { token: authorToken } = await makeUser();
    const { token: otherToken } = await makeUser({ nickname: "other", email: "other@x.cz" });
    const otherSub = fakeSub("https://push.example/gone");
    assert.equal(
      (await request(app).post("/api/push/subscribe").set(bearer(otherToken)).send(otherSub)).status,
      200
    );
    const res = await request(app)
      .post("/api/messages")
      .set(bearer(authorToken))
      .send({ body: "ping" });
    assert.equal(res.status, 200);
    const PushSubscription = require("../models/push-subscription");
    assert.equal(await PushSubscription.countDocuments({ endpoint: otherSub.endpoint }), 0);
  });
});
