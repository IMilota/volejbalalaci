const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const TEST_DB = "volejbalalaci_test";

async function connectTestDb() {
  const { connectDb } = require("../../db/connect");
  process.env.MONGODB_DB = TEST_DB;
  await connectDb();
}

async function resetTestDb() {
  const collections = mongoose.connection.collections;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
}

async function disconnectTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

module.exports = { connectTestDb, resetTestDb, disconnectTestDb, TEST_DB };
