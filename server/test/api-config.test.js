const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");

describe("GET /api/config", () => {
  let app;
  before(async () => {
    await connectTestDb();
    ({ app } = require("../app"));
  });
  after(disconnectTestDb);
  beforeEach(resetTestDb);

  it("returns featureRides and vapidPublicKey without auth", async () => {
    process.env.FEATURE_RIDES = "true";
    delete process.env.VAPID_PUBLIC_KEY;
    const res = await request(app).get("/api/config");
    assert.equal(res.status, 200);
    assert.equal(res.body.featureRides, true);
    assert.equal(res.body.vapidPublicKey, null);
  });

  it("no longer serves file-DAO event list", async () => {
    const res = await request(app).get("/api/volejbalalaci/event/list");
    assert.equal(res.status, 404);
  });
});
