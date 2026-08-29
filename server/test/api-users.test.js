const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const { createSession, bearer } = require("./helpers/http");

describe("users", () => {
  let app;
  before(async () => {
    await connectTestDb();
    await User.syncIndexes();
    ({ app } = require("../app"));
  });
  after(disconnectTestDb);
  beforeEach(resetTestDb);

  async function makeUser(overrides = {}) {
    return User.create({
      name: "Member",
      nickname: "member",
      email: "member@x.cz",
      role: "user",
      ...overrides,
    });
  }

  it("GET /api/users returns 401 without a token", async () => {
    const res = await request(app).get("/api/users");
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "unauthorized");
  });

  it("GET /api/users lists users sorted by nickname for any logged-in user", async () => {
    await makeUser({ name: "Zed", nickname: "zed", email: "zed@x.cz" });
    const alfa = await makeUser({ name: "Alfa", nickname: "alfa", email: "alfa@x.cz" });
    const token = await createSession(alfa);
    const res = await request(app).get("/api/users").set(bearer(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].nickname, "alfa");
    assert.equal(res.body[1].nickname, "zed");
    assert.equal(res.body[0].email, "alfa@x.cz");
    assert.equal(res.body[0].tokenHash, undefined);
  });

  it("admin can POST a user with default role user", async () => {
    const admin = await makeUser({
      name: "A",
      nickname: "adm",
      email: "adm@x.cz",
      role: "admin",
    });
    const token = await createSession(admin);
    const res = await request(app)
      .post("/api/users")
      .set(bearer(token))
      .send({ name: "New", nickname: "newbie", email: "new@x.cz" });
    assert.equal(res.status, 200);
    assert.ok(res.body.id);
    assert.equal(res.body.nickname, "newbie");
    assert.equal(res.body.email, "new@x.cz");
    assert.equal(res.body.role, "user");
  });

  it("non-admin POST /api/users returns 403", async () => {
    const user = await makeUser();
    const token = await createSession(user);
    const res = await request(app)
      .post("/api/users")
      .set(bearer(token))
      .send({ name: "X", nickname: "x", email: "x@x.cz" });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "forbidden");
  });

  it("POST duplicate email returns 409 emailAlreadyExists", async () => {
    const admin = await makeUser({
      nickname: "adm",
      email: "adm@x.cz",
      role: "admin",
    });
    await makeUser({ nickname: "taken", email: "dup@x.cz" });
    const token = await createSession(admin);
    const res = await request(app)
      .post("/api/users")
      .set(bearer(token))
      .send({ name: "B", nickname: "other", email: "dup@x.cz" });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "emailAlreadyExists");
  });

  it("PATCH unknown user returns 404 userNotFound", async () => {
    const admin = await makeUser({
      nickname: "adm",
      email: "adm@x.cz",
      role: "admin",
    });
    const token = await createSession(admin);
    const res = await request(app)
      .patch("/api/users/000000000000000000000000")
      .set(bearer(token))
      .send({ name: "Nope" });
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "userNotFound");
  });

  it("admin can PATCH name nickname email and role", async () => {
    const admin = await makeUser({
      nickname: "adm",
      email: "adm@x.cz",
      role: "admin",
    });
    const target = await makeUser({ nickname: "old", email: "old@x.cz" });
    const token = await createSession(admin);
    const res = await request(app)
      .patch(`/api/users/${target.id}`)
      .set(bearer(token))
      .send({ name: "Updated", nickname: "fresh", email: "fresh@x.cz", role: "admin" });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Updated");
    assert.equal(res.body.nickname, "fresh");
    assert.equal(res.body.email, "fresh@x.cz");
    assert.equal(res.body.role, "admin");
  });

  it("rejects demoting the last admin", async () => {
    const admin = await User.create({
      name: "A",
      nickname: "adm",
      email: "adm@x.cz",
      role: "admin",
    });
    const token = await createSession(admin);
    const res = await request(app)
      .patch(`/api/users/${admin.id}`)
      .set(bearer(token))
      .send({ role: "user" });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "lastAdmin");
  });
});
