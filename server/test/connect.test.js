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
});
