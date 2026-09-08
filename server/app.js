const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const cors = require("cors");
const { connectDb } = require("./db/connect");
const { seedAdmin } = require("./db/seed-admin");
const { sendError } = require("./http/errors");
const { asyncHandler } = require("./http/asyncHandler");
const { mapMongoError } = require("./http/mongo-errors");
const { requireAuth } = require("./middleware/auth");
const configRouter = require("./routes/config");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const eventsRouter = require("./routes/events");
const attendancesRouter = require("./routes/attendances");
const messagesRouter = require("./routes/messages");
const { eventRidesRouter, ridesRouter } = require("./routes/rides");
const pushRouter = require("./routes/push");
const cron = require("node-cron");
const { runAttendanceReminders } = require("./services/reminders");

const app = express();
const port = process.env.PORT || 3111;

function frontendDistDir() {
  return path.resolve(process.env.FRONTEND_DIST_DIR || path.join(__dirname, "dist"));
}

function frontendIndexPath() {
  return path.join(frontendDistDir(), "index.html");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use("/api/config", configRouter);
app.use("/api/auth", authRouter);
app.get("/api/me", requireAuth, asyncHandler(async (req, res) => {
  res.json(req.user.toJSON());
}));
app.use("/api/users", usersRouter);
app.use("/api/events", eventsRouter);
app.use("/api/events/:eventId/attendances", attendancesRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/events/:eventId/rides", eventRidesRouter);
app.use("/api/rides", ridesRouter);
app.use("/api/push", pushRouter);

app.use((req, res, next) => {
  express.static(frontendDistDir())(req, res, next);
});

app.get(/^\/(?!api).*/, async (_req, res) => {
  const indexPath = frontendIndexPath();
  try {
    await fs.access(indexPath);
    res.sendFile(indexPath);
  } catch {
    res.status(503).send("Frontend is not built. Run: npm run build:frontend (inside server).");
  }
});

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
  cron.schedule("*/15 * * * *", () => {
    runAttendanceReminders().catch((err) => console.error(err));
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { app, start };
