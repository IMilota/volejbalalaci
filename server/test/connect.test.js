const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { connectTestDb, disconnectTestDb, TEST_DB } = require("./helpers/mongo");

describe("mongo connection", () => {
  before(async () => {
    await connectTestDb();
  });

  after(async () => {
    await disconnectTestDb();
  });

  it("connects to the test database", () => {
    assert.equal(mongoose.connection.readyState, 1);
    assert.equal(mongoose.connection.name, TEST_DB);
  });

  it("reconnects to TEST_DB when already connected to another database", async () => {
    const { connectDb } = require("../db/connect");
    await mongoose.disconnect();
    process.env.MONGODB_DB = "volejbalalaci_other";
    await connectDb();
    assert.equal(mongoose.connection.name, "volejbalalaci_other");
    await connectTestDb();
    assert.equal(mongoose.connection.name, TEST_DB);
  });

  it("refuses dropDatabase when connected to a non-test database", async () => {
    const { connectDb, disconnectDb } = require("../db/connect");
    await mongoose.disconnect();
    process.env.MONGODB_DB = "volejbalalaci_other";
    await connectDb();
    await assert.rejects(() => disconnectTestDb(), /volejbalalaci_test/);
    assert.equal(mongoose.connection.readyState, 1);
    assert.equal(mongoose.connection.name, "volejbalalaci_other");
    await disconnectDb();
    await connectTestDb();
  });
});
