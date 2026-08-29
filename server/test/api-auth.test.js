const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const LoginChallenge = require("../models/login-challenge");
const { hashToken } = require("../helpers/hash-token");
const { createSession, bearer } = require("./helpers/http");

describe("auth", () => {
  let app;
  before(async () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    await connectTestDb();
    ({ app } = require("../app"));
  });
  after(disconnectTestDb);
  beforeEach(resetTestDb);

  it("challenge returns the same 200 for unknown and known email", async () => {
    await User.create({ name: "A", nickname: "a", email: "a@x.cz", role: "user" });
    const unknown = await request(app).post("/api/auth/challenge").send({ email: "nope@x.cz" });
    const known = await request(app).post("/api/auth/challenge").send({ email: "a@x.cz" });
    assert.equal(unknown.status, 200);
    assert.equal(known.status, 200);
    assert.deepEqual(unknown.body, { ok: true });
    assert.deepEqual(known.body, { ok: true });
    assert.equal(await LoginChallenge.countDocuments(), 1);
  });

  it("consume returns a session token different from the challenge", async () => {
    const user = await User.create({ name: "A", nickname: "a", email: "a@x.cz", role: "user" });
    const challenge = "aa".repeat(32);
    await LoginChallenge.create({
      userId: user._id,
      tokenHash: hashToken(challenge),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    const res = await request(app).post("/api/auth/consume").send({ token: challenge });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.notEqual(res.body.token, challenge);
    assert.equal(res.body.user.email, "a@x.cz");
    const again = await request(app).post("/api/auth/consume").send({ token: challenge });
    assert.equal(again.status, 401);
    assert.equal(again.body.code, "unauthorized");
  });

  it("GET /api/me requires a bearer session", async () => {
    const denied = await request(app).get("/api/me");
    assert.equal(denied.status, 401);
    const user = await User.create({ name: "A", nickname: "a", email: "a@x.cz", role: "user" });
    const token = await createSession(user);
    const ok = await request(app).get("/api/me").set(bearer(token));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.email, "a@x.cz");
  });
});
