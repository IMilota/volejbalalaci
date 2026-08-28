const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const { seedAdmin } = require("../db/seed-admin");

describe("User", () => {
  before(async () => {
    await connectTestDb();
    await User.syncIndexes();
  });
  after(disconnectTestDb);
  beforeEach(resetTestDb);

  it("stores lowercase email, trimmed nickname, default role user, and id in toJSON", async () => {
    const user = await User.create({
      name: "Tereza Nová",
      nickname: "  tera  ",
      email: "Tera@Example.COM",
    });
    assert.equal(user.email, "tera@example.com");
    assert.equal(user.nickname, "tera");
    assert.equal(user.role, "user");
    const json = user.toJSON();
    assert.equal(json.id, String(user._id));
    assert.equal(json._id, undefined);
    assert.ok(json.createdAt);
    assert.ok(json.updatedAt);
  });

  it("rejects duplicate email and duplicate nickname", async () => {
    await User.create({ name: "A", nickname: "n1", email: "a@x.cz" });
    await assert.rejects(
      () => User.create({ name: "B", nickname: "n2", email: "a@x.cz" }),
      { name: "MongoServerError" }
    );
    await assert.rejects(
      () => User.create({ name: "C", nickname: "n1", email: "c@x.cz" }),
      { name: "MongoServerError" }
    );
  });

  it("rejects invalid role", async () => {
    await assert.rejects(
      () => User.create({ name: "A", nickname: "n", email: "a@x.cz", role: "athlete" }),
      { name: "ValidationError" }
    );
  });

  it("seeds first admin only when users is empty", async () => {
    process.env.SEED_ADMIN_EMAIL = "admin@x.cz";
    process.env.SEED_ADMIN_NAME = "Ivo Milota";
    process.env.SEED_ADMIN_NICKNAME = "ivo";
    await seedAdmin();
    await seedAdmin();
    const users = await User.find();
    assert.equal(users.length, 1);
    assert.equal(users[0].role, "admin");
    assert.equal(users[0].email, "admin@x.cz");
  });

  it("throws when users is empty and seed env is missing", async () => {
    delete process.env.SEED_ADMIN_EMAIL;
    delete process.env.SEED_ADMIN_NAME;
    delete process.env.SEED_ADMIN_NICKNAME;
    await assert.rejects(() => seedAdmin(), /SEED_ADMIN_/);
  });
});
