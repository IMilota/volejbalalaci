const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const request = require("supertest");
const { connectTestDb, disconnectTestDb } = require("./helpers/mongo");

describe("frontend hosting", () => {
  let app;
  let distDir;

  before(async () => {
    distDir = await fs.mkdtemp(path.join(os.tmpdir(), "vb-frontend-"));
    process.env.FRONTEND_DIST_DIR = distDir;
    await connectTestDb();
    ({ app } = require("../app"));
  });

  after(async () => {
    await disconnectTestDb();
    await fs.rm(distDir, { recursive: true, force: true });
  });

  it("GET / without a built frontend returns 503", async () => {
    await fs.rm(path.join(distDir, "index.html"), { force: true });
    const res = await request(app).get("/");
    assert.equal(res.status, 503);
    assert.match(res.text, /frontend is not built/i);
  });

  it("GET / and SPA paths serve index.html when the frontend is built", async () => {
    await fs.writeFile(path.join(distDir, "index.html"), "<!doctype html><title>hosted</title>");
    const home = await request(app).get("/");
    assert.equal(home.status, 200);
    assert.match(home.text, /hosted/);
    const spa = await request(app).get("/events");
    assert.equal(spa.status, 200);
    assert.match(spa.text, /hosted/);
  });

  it("does not capture /api routes", async () => {
    const res = await request(app).get("/api/config");
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.featureRides, "boolean");
  });
});
