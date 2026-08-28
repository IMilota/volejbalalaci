const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const { hashToken } = require("../helpers/hash-token");
const LoginChallenge = require("../models/login-challenge");
const Session = require("../models/session");

describe("auth models", () => {
  let user;

  before(async () => {
    await connectTestDb();
    await LoginChallenge.syncIndexes();
    await Session.syncIndexes();
  });
  after(disconnectTestDb);
  beforeEach(async () => {
    await resetTestDb();
    user = await User.create({ name: "A", nickname: "a", email: "a@x.cz" });
  });

  it("hashToken is SHA-256 hex", () => {
    const expected = crypto.createHash("sha256").update("secret").digest("hex");
    assert.equal(hashToken("secret"), expected);
  });

  it("stores hashed challenge and allows multiple unused challenges", async () => {
    const token = "abc";
    await LoginChallenge.create({
      userId: user._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    await LoginChallenge.create({
      userId: user._id,
      tokenHash: hashToken("other"),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    assert.equal(await LoginChallenge.countDocuments({ userId: user._id }), 2);
    const indexes = await LoginChallenge.collection.indexes();
    const ttl = indexes.find((idx) => idx.expireAfterSeconds === 0);
    assert.ok(ttl);
    assert.ok(ttl.key.expiresAt === 1);
  });

  it("allows multiple sessions for one user", async () => {
    await Session.create({
      userId: user._id,
      tokenHash: hashToken("phone"),
      lastUsedAt: new Date(),
    });
    await Session.create({
      userId: user._id,
      tokenHash: hashToken("browser"),
      lastUsedAt: new Date(),
    });
    assert.equal(await Session.countDocuments({ userId: user._id }), 2);
  });

  it("rejects a second Session with the same tokenHash", async () => {
    const tokenHash = hashToken("dup-session");
    await Session.create({
      userId: user._id,
      tokenHash,
      lastUsedAt: new Date(),
    });
    await assert.rejects(
      () =>
        Session.create({
          userId: user._id,
          tokenHash,
          lastUsedAt: new Date(),
        }),
      { name: "MongoServerError" }
    );
  });

  it("rejects a second LoginChallenge with the same tokenHash", async () => {
    const tokenHash = hashToken("dup-challenge");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await LoginChallenge.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });
    await assert.rejects(
      () =>
        LoginChallenge.create({
          userId: user._id,
          tokenHash,
          expiresAt,
        }),
      { name: "MongoServerError" }
    );
  });
});
