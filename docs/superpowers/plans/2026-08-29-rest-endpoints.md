# REST endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace file-DAO `/api/volejbalalaci/*` with REST under `/api` (auth, users, events, attendances, messages, rides, Web Push, 24h reminders).

**Architecture:** Express routers + `requireAuth`/`requireAdmin` + `sendError`. Services: `mail.js` (SMTP or log), `push.js` (`web-push`), `reminders.js` (callable from cron and tests). Models stay Mongoose. Cron starts only inside `start()` after `listen`, never when tests `require("../app")`.

**Tech Stack:** Express 4, Mongoose 9, `supertest`, `nodemailer`, `web-push`, `node-cron`. Existing `hashToken`, `Session`, `LoginChallenge`, `User`, `Event`, `Attendance`, `Message`, `Ride`.

**Spec:** `docs/superpowers/specs/2026-08-29-rest-endpoints-design.md`

## Global Constraints

- Never `npm install` / `npm ci` / `npm update`; use `npx uu-safe-install` from `server/`.
- Error JSON: `{ "code": "...", "message": "..." }` with the spec’s code strings.
- `Authorization: Bearer <sessionToken>`; hash with `hashToken` before Session lookup.
- Public only: `GET /api/config`, `POST /api/auth/challenge`, `POST /api/auth/consume`.
- Tests: `volejbalalaci_test`, `node --test --test-concurrency=1 test/**/*.test.js`, Shell `required_permissions: ["all"]` for Mongo.
- Do not git-add `server/.env` or `package-lock.json`.
- Frontend / PWA install button out of scope.
- `SMTP_FROM` is not the admin login email. Magic URL: `{APP_BASE_URL}/login?token={plaintext}`.
- `FEATURE_RIDES` is the string `"true"` for enabled.
- Mongo tests must not send real SMTP or real Web Push.

## File map

| File | Responsibility |
|---|---|
| `server/http/errors.js` | `sendError(res, status, code, message)` |
| `server/http/asyncHandler.js` | wrap async route, next(err) |
| `server/http/mongo-errors.js` | map ValidationError → 400, code 11000 → 409 |
| `server/middleware/auth.js` | `requireAuth`, `requireAdmin` |
| `server/routes/*.js` | REST routers |
| `server/services/mail.js` | `sendMagicLink({ to, url })` |
| `server/services/push.js` | `sendPushToUserIds(userIds, payload)`, `isPushConfigured()` |
| `server/services/reminders.js` | `runAttendanceReminders(now)` |
| `server/models/push-subscription.js` | collection `pushSubscriptions` |
| `server/test/helpers/http.js` | `bearer(token)`, `createSession(user)` |
| `server/app.js` | mount `/api`, export `{ app, start }` |

---

### Task 1: Error helper, delete old API, GET /api/config

**Files:**
- Create: `server/http/errors.js`, `server/http/asyncHandler.js`, `server/http/mongo-errors.js`, `server/routes/config.js`, `server/test/api-config.test.js`
- Modify: `server/app.js`, `server/.env.example`
- Delete: `server/controller/` (entire tree), `server/abl/` (entire tree), `server/dao/` (entire tree), `server/helpers/validate-date-time.js`
- Install: from `server/`: `npx uu-safe-install supertest`

**Interfaces:**
- Consumes: existing `app` Express instance
- Produces: `sendError(res, status, code, message)` writes JSON `{ code, message }`; `asyncHandler(fn)` ; `mapMongoError(err)` returns `{ status, code, message }` or null; `{ app, start }` exported from `app.js`; `GET /api/config` unauthenticated

- [ ] **Step 1: Install supertest**

```bash
cd server && npx uu-safe-install supertest
```

Do not commit lockfile or `.npmrc` if the installer creates one.

- [ ] **Step 2: Write failing config test**

`server/http/errors.js` (implement with routes in step 4; test first against intended API):

`server/test/api-config.test.js`:

```javascript
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
```

- [ ] **Step 3: Run test — must fail**

```bash
cd server && node --test --test-concurrency=1 test/api-config.test.js
```

Expected: FAIL (`Cannot find module '../app'` export or 404 missing / 200 on old route).

- [ ] **Step 4: Implement helpers, config route, rewrite app.js, delete old trees**

`server/http/errors.js`:

```javascript
function sendError(res, status, code, message) {
  return res.status(status).json({ code, message });
}

module.exports = { sendError };
```

`server/http/asyncHandler.js`:

```javascript
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
```

`server/http/mongo-errors.js`:

```javascript
function mapMongoError(err) {
  if (!err) return null;
  if (err.name === "ValidationError") {
    return { status: 400, code: "dtoInIsNotValid", message: err.message };
  }
  if (err.code === 11000) {
    const key = Object.keys(err.keyPattern || err.keyValue || {})[0];
    if (key === "email") {
      return { status: 409, code: "emailAlreadyExists", message: "email already exists" };
    }
    if (key === "nickname") {
      return { status: 409, code: "nicknameAlreadyExists", message: "nickname already exists" };
    }
    return { status: 409, code: "dtoInIsNotValid", message: "duplicate key" };
  }
  return null;
}

module.exports = { mapMongoError };
```

`server/routes/config.js`:

```javascript
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    featureRides: process.env.FEATURE_RIDES === "true",
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
    instanceName: process.env.INSTANCE_NAME || undefined,
    instanceIcon: process.env.INSTANCE_ICON || undefined,
    instanceColorScheme: process.env.INSTANCE_COLOR_SCHEME || undefined,
  });
});

module.exports = router;
```

Replace `server/app.js` so it does **not** require `controller/` at all:

```javascript
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
```

Delete the old trees listed in Files. Append to `server/.env.example`:

```
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
INSTANCE_NAME=
INSTANCE_ICON=
INSTANCE_COLOR_SCHEME=
```

- [ ] **Step 5: Run test — must pass**

```bash
cd server && node --test --test-concurrency=1 test/api-config.test.js
```

- [ ] **Step 6: Commit**

```bash
git add -A server/http server/routes/config.js server/app.js server/package.json server/.env.example
git add -u server/controller server/abl server/dao server/helpers/validate-date-time.js
git commit -m "$(cat <<'EOF'
feat: replace file-DAO mounts with REST config route

EOF
)"
```

Do not add `.env`, `node_modules`, lockfile.

---

### Task 2: Mail, auth middleware, challenge / consume / logout / me

**Files:**
- Create: `server/services/mail.js`, `server/middleware/auth.js`, `server/routes/auth.js`, `server/test/helpers/http.js`, `server/test/api-auth.test.js`
- Modify: `server/app.js` (mount auth routes **before** the error handler; `requireAuth` on `/api/me` and logout)

**Interfaces:**
- Consumes: `sendError`, `asyncHandler`, `hashToken`, `User`, `LoginChallenge`, `Session`
- Produces: `sendMagicLink({ to, url })` → Promise; `requireAuth(req,res,next)` sets `req.user` (User doc) and `req.session` (Session doc); `requireAdmin`; `createSession(user)` in tests returns plaintext token; `POST /api/auth/challenge` always 200 `{ ok: true }`

Challenge plaintext: `crypto.randomBytes(32).toString("hex")`. Session token: new independent `crypto.randomBytes(32).toString("hex")`. Challenge `expiresAt` = now + 30 minutes. Consume requires `consumedAt` missing and `expiresAt > now`.

- [ ] **Step 1: Write failing auth tests**

`server/test/helpers/http.js`:

```javascript
const crypto = require("crypto");
const { hashToken } = require("../../helpers/hash-token");
const Session = require("../../models/session");

async function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  await Session.create({
    userId: user._id,
    tokenHash: hashToken(token),
    lastUsedAt: new Date(),
  });
  return token;
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createSession, bearer };
```

`server/test/api-auth.test.js` (require app after env):

```javascript
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const LoginChallenge = require("../models/login-challenge");
const { hashToken } = require("../helpers/hash-token");
const { createSession, bearer } = require("./helpers/http");

describe("auth", () => {
  let app;
  before(async () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    await connectTestDb();
    ({ app } = require("../app"));
  });
  after(disconnectTestDb);
  beforeEach(resetTestDb);

  it("challenge returns the same 200 for unknown and known email", async () => {
    await User.create({ name: "A", nickname: "a", email: "a@x.cz", role: "user" });
    const unknown = await request(app).post("/api/auth/challenge").send({ email: "nope@x.cz" });
    const known = await request(app).post("/api/auth/challenge").send({ email: "a@x.cz" });
    assert.equal(unknown.status, 200);
    assert.equal(known.status, 200);
    assert.deepEqual(unknown.body, { ok: true });
    assert.deepEqual(known.body, { ok: true });
    assert.equal(await LoginChallenge.countDocuments(), 1);
  });

  it("consume returns a session token different from the challenge", async () => {
    const user = await User.create({ name: "A", nickname: "a", email: "a@x.cz", role: "user" });
    const challenge = "aa".repeat(32);
    await LoginChallenge.create({
      userId: user._id,
      tokenHash: hashToken(challenge),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    const res = await request(app).post("/api/auth/consume").send({ token: challenge });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.notEqual(res.body.token, challenge);
    assert.equal(res.body.user.email, "a@x.cz");
    const again = await request(app).post("/api/auth/consume").send({ token: challenge });
    assert.equal(again.status, 401);
    assert.equal(again.body.code, "unauthorized");
  });

  it("GET /api/me requires a bearer session", async () => {
    const denied = await request(app).get("/api/me");
    assert.equal(denied.status, 401);
    const user = await User.create({ name: "A", nickname: "a", email: "a@x.cz", role: "user" });
    const token = await createSession(user);
    const ok = await request(app).get("/api/me").set(bearer(token));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.email, "a@x.cz");
  });
});
```

- [ ] **Step 2: Run — must fail**

```bash
cd server && node --test --test-concurrency=1 test/api-auth.test.js
```

- [ ] **Step 3: Implement mail, middleware, auth router**

`server/services/mail.js`:

```javascript
const nodemailer = require("nodemailer");

async function sendMagicLink({ to, url }) {
  const from = process.env.SMTP_FROM;
  const host = process.env.SMTP_HOST;
  if (!host || !from) {
    console.log(`[magic-link] ${to} ${url}`);
    return { delivered: false };
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  await transporter.sendMail({
    from,
    to,
    subject: "Přihlášení do Volejbalaláci",
    text: url,
  });
  return { delivered: true };
}

module.exports = { sendMagicLink };
```

Install: `npx uu-safe-install nodemailer`

`server/middleware/auth.js`:

```javascript
const { hashToken } = require("../helpers/hash-token");
const Session = require("../models/session");
const User = require("../models/user");
const { sendError } = require("../http/errors");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      return sendError(res, 401, "unauthorized", "missing token");
    }
    const session = await Session.findOne({ tokenHash: hashToken(token) });
    if (!session) {
      return sendError(res, 401, "unauthorized", "invalid token");
    }
    const user = await User.findById(session.userId);
    if (!user) {
      return sendError(res, 401, "unauthorized", "invalid token");
    }
    session.lastUsedAt = new Date();
    await session.save();
    req.user = user;
    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return sendError(res, 403, "forbidden", "admin only");
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
```

`server/routes/auth.js` — implement:

- `POST /challenge`: if no `email` → 400 `dtoInIsNotValid`. Lowercase email. `User.findOne`. If user, create challenge + `sendMagicLink({ to: user.email, url: `${process.env.APP_BASE_URL}/login?token=${plaintext}` })`. Always `res.json({ ok: true })`.
- `POST /consume`: find challenge by `hashToken(token)` with `consumedAt` unset and `expiresAt > new Date()`. Else 401 `unauthorized`. Set `consumedAt`, create Session with new token, `res.json({ token, user: user.toJSON() })`.
- `POST /logout`: `requireAuth` then `Session.deleteOne({ _id: req.session._id })`, 200 `{ ok: true }`.
- `POST /logout-all`: `Session.deleteMany({ userId: req.user._id })`.
- `GET /me`: `requireAuth`, `res.json(req.user.toJSON())`.

Mount in `app.js` **before** the error middleware:

```javascript
const authRouter = require("./routes/auth");
app.use("/api/auth", authRouter);
app.get("/api/me", requireAuth, asyncHandler(async (req, res) => {
  res.json(req.user.toJSON());
}));
```

Prefer putting `/me` on `authRouter` as `router.get("/me", requireAuth, ...)` **or** keep `app.get("/api/me", ...)` as the spec path `/api/me` (not `/api/auth/me`). Spec is `GET /api/me` — mount on `app`, not under `/api/auth`.

Logout paths are `/api/auth/logout` and `/api/auth/logout-all`.

- [ ] **Step 4: Run auth tests — pass**

```bash
cd server && node --test --test-concurrency=1 test/api-auth.test.js
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add magic-link auth and session middleware

EOF
)"
```

---

### Task 3: Users and events (`reminderSentAt`)

**Files:**
- Create: `server/routes/users.js`, `server/routes/events.js`, `server/test/api-users.test.js`, `server/test/api-events.test.js`
- Modify: `server/models/event.js` (add `reminderSentAt: { type: Date, default: undefined }`), `server/app.js`

**Interfaces:**
- Consumes: `requireAuth`, `requireAdmin`, `createSession`, `bearer`, `Attendance.occupiedSeats`
- Produces: REST as spec; event JSON includes `occupied` number; PATCH must not accept `status` or `reminderSentAt`

- [ ] **Step 1: Write failing tests**

Users: admin can POST user; non-admin 403; GET /api/users 401 without token; last admin cannot PATCH own role to `user`.

Events: non-admin POST 403; admin POST returns `id` and `occupied === 0`; GET default excludes past `startAt`; cancel sets `cancelled`; bulk with `occurrences: []` is 400.

Include at least this last-admin test:

```javascript
it("rejects demoting the last admin", async () => {
  const admin = await User.create({
    name: "A",
    nickname: "adm",
    email: "adm@x.cz",
    role: "admin",
  });
  const token = await createSession(admin);
  const res = await request(app)
    .patch(`/api/users/${admin.id}`)
    .set(bearer(token))
    .send({ role: "user" });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "lastAdmin");
});
```

And one events test for occupied + cancel. Put full files in the implementation matching the spec tables.

- [ ] **Step 2: Run — fail**

```bash
cd server && node --test --test-concurrency=1 test/api-users.test.js test/api-events.test.js
```

- [ ] **Step 3: Implement**

Users router: `GET /` requireAuth list `User.find().sort({ nickname: 1 })`. `POST /` requireAuth+requireAdmin `User.create`. `PATCH /:id` requireAdmin; if `role` would leave `User.countDocuments({ role: "admin" }) === 0` after the change, 409 `lastAdmin`. 404 `userNotFound`.

Events: add `reminderSentAt` on schema. `withOccupied(event)` = `{ ...event.toJSON(), occupied: await Attendance.occupiedSeats(event._id) }`. List: `from`/`to` query or default `startAt: { $gte: new Date() }`. `POST /bulk` validates `occurrences.length >= 1`. `POST /:id/cancel` sets status cancelled. `PATCH` allowlist: `name`, `startAt`, `endAt`, `location`, `capacity`, `description`.

Mount: `app.use("/api/users", usersRouter)` and `app.use("/api/events", eventsRouter)` (all routes on these routers use requireAuth; admin routes add requireAdmin).

- [ ] **Step 4: Tests pass + full suite**

```bash
cd server && npm test
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add user and event REST endpoints

EOF
)"
```

---

### Task 4: Attendances

**Files:**
- Create: `server/routes/attendances.js`, `server/test/api-attendances.test.js`
- Modify: `server/app.js` — mount **on the events router** or as `app.use("/api/events/:eventId/attendances", ...)`

**Interfaces:**
- Consumes: `Attendance.wouldExceedCapacity`, `Event`
- Produces: `PUT .../me` and `PUT .../:userId` upsert; 409 `capacityExceeded` / `eventCancelled`

Register `router.put("/me", ...)` **before** `router.put("/:userId", ...)`.

- [ ] **Step 1: Failing tests** — user cannot PUT another user’s attendance (403); admin can; `yes` that exceeds capacity is 409; cancelled event 409; guests ignored for `maybe`.

- [ ] **Step 2: Run fail**

```bash
cd server && node --test --test-concurrency=1 test/api-attendances.test.js
```

- [ ] **Step 3: Implement upsert**

Load event; 404 `eventNotFound`; if `cancelled` → 409 `eventCancelled`. Target userId from `me` or param. Non-admin and param !== req.user.id → 403. `wouldExceedCapacity(event._id, event.capacity, { status, guests, excludeId: existing?._id })`. Then `findOneAndUpdate` with `upsert` **or** save document so `pre("validate")` runs (prefer load/create document and `.save()`).

- [ ] **Step 4: Pass + `npm test`**

- [ ] **Step 5: Commit** `feat: add attendance REST endpoints`

---

### Task 5: Messages and rides

**Files:**
- Create: `server/routes/messages.js`, `server/routes/rides.js`, `server/test/api-messages.test.js`, `server/test/api-rides.test.js`
- Modify: `server/app.js`

**Interfaces:**
- Consumes: `Message.createReply` / `Message.create` + `deleteWithReplies`; `Ride`
- Produces: spec paths; ride router checks `process.env.FEATURE_RIDES === "true"` else `sendError(res, 404, "ridesDisabled", "rides disabled")` on **every** ride handler including GET

Messages: `GET /api/messages` with optional `eventId`. If query omitted, `eventId: null`. POST may call `createReply` when `replyToId` set. PATCH/DELETE: author or admin else 403. Do **not** wire push yet (Task 6).

Rides: join pushes `userId` onto `passengerIds` then save (validators). Unique driver → 409 `rideAlreadyOffered`. Full → 409 `rideFull`. Cancelled event → 409 `eventCancelled`.

- [ ] **Step 1: Failing tests** — board GET; reply-to-reply 400; non-author cannot PATCH; rides 404 when `FEATURE_RIDES=false`; join when seats=1 and already one passenger → 409.

- [ ] **Step 2: Run fail**

- [ ] **Step 3: Implement routers, mount `/api/messages`, `/api/events/:eventId/rides`, `/api/rides`

- [ ] **Step 4: `npm test`**

- [ ] **Step 5: Commit** `feat: add message and ride REST endpoints`

---

### Task 6: Push subscriptions, send on message, reminder cron

**Files:**
- Create: `server/models/push-subscription.js`, `server/services/push.js`, `server/services/reminders.js`, `server/routes/push.js`, `server/test/api-push.test.js`, `server/test/reminders.test.js`
- Modify: `server/routes/messages.js` (after save, `sendPushToUserIds`), `server/app.js` (`start` schedules cron), `server/package.json` via uu-safe-install `web-push` `node-cron`

**Interfaces:**
- Consumes: `User`, `Attendance`, `Event`, `PushSubscription`
- Produces: `isPushConfigured()` true iff public+private+subject env all non-empty; `sendPushToUserIds(userIds, payload)` skips empty; `runAttendanceReminders(now = new Date())` returns `{ eventIds: string[] }`; cron `*/15 * * * *` only in `start()` after listen

Push model: collection `pushSubscriptions`; unique `endpoint`; fields `userId`, `endpoint`, `p256dh`, `auth`.

`web-push.setVapidDetails(subject, publicKey, privateKey)` when configured. On send error statusCode 404 or 410, `PushSubscription.deleteOne({ endpoint })`.

Reminders window: `startAt > now + 23h` AND `startAt <= now + 25h`, `status: "scheduled"`, `reminderSentAt` missing. Recipients: all User ids that have a PushSubscription and whose Attendance for the event is not `yes`/`no`. Then set `reminderSentAt`.

- [ ] **Step 1: Install** `npx uu-safe-install web-push node-cron`

- [ ] **Step 2: Failing tests**

Subscribe without VAPID → 503 `pushNotConfigured`. With VAPID env set in test, POST subscribe 200. DELETE by endpoint. Stub `web-push.sendNotification` in message POST test: author has no send, other user does. `runAttendanceReminders`: user with `yes` is not targeted; second run does not send again.

Do not start cron in tests.

- [ ] **Step 3: Run fail**

- [ ] **Step 4: Implement model, services, routes; call `sendPushToUserIds` from message POST excluding `req.user._id`; `start()`:

```javascript
const cron = require("node-cron");
const { runAttendanceReminders } = require("./services/reminders");
// after listen:
cron.schedule("*/15 * * * *", () => {
  runAttendanceReminders().catch((err) => console.error(err));
});
```

- [ ] **Step 5: `npm test` all  — 0 fail**

- [ ] **Step 6: Commit** `feat: add Web Push subscriptions and attendance reminders`

---

## Spec coverage

| Spec item | Task |
|---|---|
| Delete old API, error JSON, GET config | 1 |
| Auth challenge/consume/logout/me, mail log/SMTP | 2 |
| Users, lastAdmin, events, occupied, bulk, cancel, reminderSentAt field | 3 |
| Attendances upsert, capacity, cancelled | 4 |
| Messages, rides, ridesDisabled | 5 |
| Push subscribe, skip author, cron window, reminderSentAt write | 6 |
| PWA install button | out of scope |

`GET /api/me` is Task 2. Theme keys on config are Task 1 (optional env). Unique 11000 mapping is Task 1 + used in Task 3.
