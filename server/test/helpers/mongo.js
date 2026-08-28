const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../../.env"), quiet: true });

const TEST_DB = "volejbalalaci_test";

async function connectTestDb() {
  const { connectDb } = require("../../db/connect");
  process.env.MONGODB_DB = TEST_DB;
  if (mongoose.connection.readyState !== 0 && mongoose.connection.name !== TEST_DB) {
    await mongoose.disconnect();
  }
  await connectDb();
}

async function resetTestDb() {
  const collections = mongoose.connection.collections;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
}

async function disconnectTestDb() {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  if (mongoose.connection.name !== TEST_DB) {
    throw new Error(
      `Refusing to drop database "${mongoose.connection.name}" (expected ${TEST_DB})`
    );
  }
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

module.exports = { connectTestDb, resetTestDb, disconnectTestDb, TEST_DB };
