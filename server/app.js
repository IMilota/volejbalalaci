const express = require("express");
const cors = require("cors");
const { connectDb } = require("./db/connect");
const { seedAdmin } = require("./db/seed-admin");
const { sendError } = require("./http/errors");
const { mapMongoError } = require("./http/mongo-errors");
const configRouter = require("./routes/config");

const app = express();
const port = process.env.PORT || 3111;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (req, res) => {
  res.send("Volejbalalaci");
});

app.use("/api/config", configRouter);

app.use((err, req, res, next) => {
  const mapped = mapMongoError(err);
  if (mapped) {
    return sendError(res, mapped.status, mapped.code, mapped.message);
  }
  console.error(err);
  return sendError(res, 500, "internalError", err.message || "internal error");
});

async function start() {
  await connectDb();
  await seedAdmin();
  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { app, start };
