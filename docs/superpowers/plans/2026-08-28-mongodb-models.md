# MongoDB models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install native MongoDB, connect the Express server with Mongoose, and persist the spec collections (users, events, attendances, messages, rides, loginChallenges, sessions) with validation, indexes, and first-admin seed — without changing HTTP endpoints yet.

**Architecture:** Keep existing file-DAO routes running. Add `server/db/` (connection + seed) and `server/models/` (one Mongoose model per collection). `app.js` connects and seeds before `listen`. Tests use Node’s built-in test runner against database `volejbalalaci_test`. Occupancy, reply rules, and ride seat rules that belong on the document live as schema validators / statics; HTTP permission checks stay for the later endpoint plan.

**Tech Stack:** MongoDB 8 Community (`mongod` on localhost:27017, not Docker), Node.js CommonJS, Express 4 (existing), Mongoose 8, `dotenv`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-28-mongodb-domain-model-design.md`

## Global Constraints

- Never run `npm install` / `npm ci` / `npm update`; use `npx uu-safe-install` from `server/`.
- MongoDB is a native Fedora install, not the user’s Docker Mongo.
- Connection string from `MONGODB_URI`; database name from `MONGODB_DB` (default `volejbalalaci`).
- API documents expose `id` as `String(_id)`; schemas use Mongoose `timestamps`.
- Collection names: `users`, `events`, `attendances`, `messages`, `rides`, `loginChallenges`, `sessions`.
- Do not migrate JSON files under `server/dao/volejbalalaci/storage/`.
- Do not rewrite controllers/ABL in this plan.
- Permissions, SMTP, `FEATURE_RIDES` HTTP refusal, magic-link mail, and frontend theme are **not** this plan.
- Token hashes are SHA-256 hex (`crypto.createHash("sha256")`).
- Board messages store `eventId: null` (never omit the field).
- Tests must not use the production DB name; use `volejbalalaci_test`.

## File map

| File | Responsibility |
|---|---|
| `server/.env.example` | Documented env keys |
| `server/.env` | Local secrets (gitignored) |
| `server/db/connect.js` | `connectDb()` / `disconnectDb()` |
| `server/db/seed-admin.js` | Insert first admin when `users` is empty |
| `server/helpers/hash-token.js` | SHA-256 for challenge/session secrets |
| `server/models/user.js` | User schema |
| `server/models/event.js` | Event schema |
| `server/models/attendance.js` | Attendance schema + occupancy statics |
| `server/models/message.js` | Message schema + reply / cascade delete |
| `server/models/ride.js` | Ride schema |
| `server/models/login-challenge.js` | LoginChallenge schema + TTL index |
| `server/models/session.js` | Session schema |
| `server/test/helpers/mongo.js` | Test DB connect / reset |
| `server/test/*.test.js` | Model tests |
| `server/app.js` | Connect + seed then listen |
| `server/package.json` | `mongoose`, `dotenv`, `test` script |
| `.gitignore` | `.env` |

---

### Task 1: MongoDB install, env, Mongoose connection

**Files:**
- Create: `server/.env.example`
- Create: `server/.env` (do not git-add)
- Create: `server/db/connect.js`
- Create: `server/test/helpers/mongo.js`
- Create: `server/test/connect.test.js`
- Modify: `/home/ivomilota/Projects/gitHub/volejbalalaci/.gitignore`
- Modify: `server/package.json`
- Modify: `server/app.js`

**Interfaces:**
- Consumes: none
- Produces: `connectDb()` → `Promise<void>`; `disconnectDb()` → `Promise<void>`; env `MONGODB_URI`, `MONGODB_DB`

- [ ] **Step 1: Install MongoDB 8 Community on Fedora (native, not Docker)**

Check AVX, then add the official RHEL 9 repo and install. These commands need sudo (the human must approve).

```bash
grep -qm1 '^flags.*avx' /proc/cpuinfo && echo AVX_OK || echo AVX_MISSING
command -v mongod && mongod --version || true
```

If `mongod` is missing:

```bash
sudo tee /etc/yum.repos.d/mongodb-org-8.0.repo > /dev/null <<'EOF'
[mongodb-org-8.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/8.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-8.0.asc
EOF

sudo dnf install -y mongodb-org
sudo systemctl enable --now mongod
sudo systemctl --no-pager status mongod
```

Do **not** use the existing Docker Mongo. Confirm the service is `mongod` on this host.

- [ ] **Step 2: Verify mongod accepts connections**

```bash
mongosh --eval 'db.runCommand({ ping: 1 })' --quiet
```

Expected: `{ ok: 1 }` (or a document with `ok: 1`).

- [ ] **Step 3: Gitignore `.env` and add example env**

Append to `.gitignore`:

```
.env
```

Create `server/.env.example`:

```
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=volejbalalaci
FEATURE_RIDES=true
SEED_ADMIN_EMAIL=you@example.com
SEED_ADMIN_NAME=Ivo Milota
SEED_ADMIN_NICKNAME=ivo
APP_BASE_URL=http://localhost:3000
```

Copy to `server/.env` and put the real admin email/name/nickname. Do not commit `.env`.

- [ ] **Step 4: Add mongoose and dotenv**

From `server/`:

```bash
npx uu-safe-install mongoose dotenv
```

Change `server/package.json` scripts to:

```json
"start": "node app.js",
"test": "node --test test/"
```

- [ ] **Step 5: Write the failing connection test**

Create `server/db/connect.js` as a stub that throws so the test fails for the right reason only after you add the test — actually write the test first against the intended API:

`server/test/helpers/mongo.js`:

```javascript
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
```

`server/test/connect.test.js`:

```javascript
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
```

- [ ] **Step 6: Run the test — it must fail (connectDb missing)**

```bash
cd server && node --test test/connect.test.js
```

Expected: FAIL, `Cannot find module '../../db/connect'` (or `connectDb is not a function`).

- [ ] **Step 7: Implement connection and wire `app.js`**

`server/db/connect.js`:

```javascript
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  const dbName = process.env.MONGODB_DB || "volejbalalaci";
  await mongoose.connect(uri, { dbName });
}

async function disconnectDb() {
  await mongoose.disconnect();
}

module.exports = { connectDb, disconnectDb };
```

In `server/app.js`, keep existing routes. After creating `app`, replace the bare `app.listen` with:

```javascript
const { connectDb } = require("./db/connect");

async function start() {
  await connectDb();
  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 8: Run the test — it must pass**

```bash
cd server && node --test test/connect.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add .gitignore server/.env.example server/db/connect.js server/test/helpers/mongo.js server/test/connect.test.js server/app.js server/package.json
git commit -m "$(cat <<'EOF'
feat: connect Express to MongoDB via Mongoose

EOF
)"
```

Do not add `server/.env` or `package-lock.json` (lockfile is gitignored in this repo).

---

### Task 2: User model and admin seed

**Files:**
- Create: `server/models/user.js`
- Create: `server/db/seed-admin.js`
- Create: `server/test/user.test.js`
- Modify: `server/app.js` (call `seedAdmin` after `connectDb`)

**Interfaces:**
- Consumes: `connectDb()` from Task 1
- Produces: `User` mongoose model; `user.toJSON()` includes `id`, `name`, `nickname`, `email`, `role`, `createdAt`, `updatedAt` and omits `_id` and `__v`; `seedAdmin()` → `Promise<void>`

Shared `toJSON` transform to put on this schema (repeat on later schemas, do not extract a package):

```javascript
function toJsonTransform(_doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}
```

- [ ] **Step 1: Write the failing tests**

`server/test/user.test.js`:

```javascript
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const { seedAdmin } = require("../db/seed-admin");

describe("User", () => {
  before(async () => {
    await connectTestDb();
    await User.syncIndexes();
  });
  after(disconnectTestDb);
  beforeEach(resetTestDb);

  it("stores lowercase email, trimmed nickname, default role user, and id in toJSON", async () => {
    const user = await User.create({
      name: "Tereza Nová",
      nickname: "  tera  ",
      email: "Tera@Example.COM",
    });
    assert.equal(user.email, "tera@example.com");
    assert.equal(user.nickname, "tera");
    assert.equal(user.role, "user");
    const json = user.toJSON();
    assert.equal(json.id, String(user._id));
    assert.equal(json._id, undefined);
    assert.ok(json.createdAt);
    assert.ok(json.updatedAt);
  });

  it("rejects duplicate email and duplicate nickname", async () => {
    await User.create({ name: "A", nickname: "n1", email: "a@x.cz" });
    await assert.rejects(
      () => User.create({ name: "B", nickname: "n2", email: "a@x.cz" }),
      { name: "MongoServerError" }
    );
    await assert.rejects(
      () => User.create({ name: "C", nickname: "n1", email: "c@x.cz" }),
      { name: "MongoServerError" }
    );
  });

  it("rejects invalid role", async () => {
    await assert.rejects(
      () => User.create({ name: "A", nickname: "n", email: "a@x.cz", role: "athlete" }),
      { name: "ValidationError" }
    );
  });

  it("seeds first admin only when users is empty", async () => {
    process.env.SEED_ADMIN_EMAIL = "admin@x.cz";
    process.env.SEED_ADMIN_NAME = "Ivo Milota";
    process.env.SEED_ADMIN_NICKNAME = "ivo";
    await seedAdmin();
    await seedAdmin();
    const users = await User.find();
    assert.equal(users.length, 1);
    assert.equal(users[0].role, "admin");
    assert.equal(users[0].email, "admin@x.cz");
  });

  it("throws when users is empty and seed env is missing", async () => {
    delete process.env.SEED_ADMIN_EMAIL;
    delete process.env.SEED_ADMIN_NAME;
    delete process.env.SEED_ADMIN_NICKNAME;
    await assert.rejects(() => seedAdmin(), /SEED_ADMIN_/);
  });
});
```

- [ ] **Step 2: Run tests — they must fail**

```bash
cd server && node --test test/user.test.js
```

Expected: FAIL, missing `../models/user`.

- [ ] **Step 3: Implement User and seedAdmin**

`server/models/user.js`:

```javascript
const mongoose = require("mongoose");

function toJsonTransform(_doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nickname: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ["admin", "user"], default: "user", required: true },
  },
  {
    timestamps: true,
    collection: "users",
    toJSON: { transform: toJsonTransform },
    toObject: { transform: toJsonTransform },
  }
);

module.exports = mongoose.model("User", userSchema);
```

`server/db/seed-admin.js`:

```javascript
const User = require("../models/user");

async function seedAdmin() {
  const count = await User.countDocuments();
  if (count > 0) return;

  const email = process.env.SEED_ADMIN_EMAIL;
  const name = process.env.SEED_ADMIN_NAME;
  const nickname = process.env.SEED_ADMIN_NICKNAME;
  if (!email || !name || !nickname) {
    throw new Error(
      "SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, and SEED_ADMIN_NICKNAME are required when users is empty"
    );
  }

  await User.create({ email, name, nickname, role: "admin" });
}

module.exports = { seedAdmin };
```

In `server/app.js` `start()`:

```javascript
const { seedAdmin } = require("./db/seed-admin");
await connectDb();
await seedAdmin();
```

- [ ] **Step 4: Run tests — they must pass**

```bash
cd server && node --test test/user.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/models/user.js server/db/seed-admin.js server/test/user.test.js server/app.js
git commit -m "$(cat <<'EOF'
feat: add User model and first-admin seed

EOF
)"
```

---

### Task 3: Event model

**Files:**
- Create: `server/models/event.js`
- Create: `server/test/event.test.js`

**Interfaces:**
- Consumes: test helper from Task 1
- Produces: `Event` model; fields `name`, `startAt`, `endAt`, `location`, `capacity`, `description`, `status`; `status` default `"scheduled"`; `endAt` must be after `startAt`; `capacity` integer ≥ 1; `toJSON().id`

- [ ] **Step 1: Write the failing tests**

`server/test/event.test.js`:

```javascript
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const Event = require("../models/event");

describe("Event", () => {
  before(async () => {
    await connectTestDb();
    await Event.syncIndexes();
  });
  after(disconnectTestDb);
  beforeEach(resetTestDb);

  it("creates a scheduled event and exposes id", async () => {
    const event = await Event.create({
      name: "Úterý",
      startAt: new Date("2026-09-01T17:00:00.000Z"),
      endAt: new Date("2026-09-01T19:00:00.000Z"),
      location: "Tělocvična ZŠ",
      capacity: 12,
    });
    assert.equal(event.status, "scheduled");
    assert.equal(event.toJSON().id, String(event._id));
  });

  it("rejects endAt before or equal to startAt", async () => {
    const startAt = new Date("2026-09-01T17:00:00.000Z");
    await assert.rejects(
      () =>
        Event.create({
          name: "Bad",
          startAt,
          endAt: startAt,
          location: "X",
          capacity: 8,
        }),
      { name: "ValidationError" }
    );
  });

  it("rejects capacity below 1 and invalid status", async () => {
    const base = {
      name: "X",
      startAt: new Date("2026-09-01T17:00:00.000Z"),
      endAt: new Date("2026-09-01T18:00:00.000Z"),
      location: "X",
    };
    await assert.rejects(() => Event.create({ ...base, capacity: 0 }), {
      name: "ValidationError",
    });
    await assert.rejects(
      () => Event.create({ ...base, capacity: 8, status: "deleted" }),
      { name: "ValidationError" }
    );
  });
});
```

- [ ] **Step 2: Run tests — they must fail**

```bash
cd server && node --test test/event.test.js
```

Expected: FAIL, missing `../models/event`.

- [ ] **Step 3: Implement Event**

`server/models/event.js`:

```javascript
const mongoose = require("mongoose");

function toJsonTransform(_doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return this.startAt && value > this.startAt;
        },
        message: "endAt must be after startAt",
      },
    },
    location: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "capacity must be an integer" } },
    description: { type: String, default: undefined },
    status: { type: String, enum: ["scheduled", "cancelled"], default: "scheduled", required: true },
  },
  {
    timestamps: true,
    collection: "events",
    toJSON: { transform: toJsonTransform },
    toObject: { transform: toJsonTransform },
  }
);

module.exports = mongoose.model("Event", eventSchema);
```

- [ ] **Step 4: Run tests — they must pass**

```bash
cd server && node --test test/event.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/models/event.js server/test/event.test.js
git commit -m "$(cat <<'EOF'
feat: add Event model

EOF
)"
```

---

### Task 4: Attendance model and occupancy

**Files:**
- Create: `server/models/attendance.js`
- Create: `server/test/attendance.test.js`

**Interfaces:**
- Consumes: `User`, `Event`
- Produces: `Attendance` model; unique `(eventId, userId)`; `status` `"yes"|"no"|"maybe"`; `guests` 0–6; `note` max 280; pre-save sets `guests` to `0` when status is not `"yes"`; `Attendance.occupiedSeats(eventId)` → `Promise<number>` (sum of `1 + guests` for `yes` only); `Attendance.wouldExceedCapacity(eventId, capacity, { status, guests, excludeId })` → `Promise<boolean>`

- [ ] **Step 1: Write the failing tests**

`server/test/attendance.test.js`:

```javascript
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const Event = require("../models/event");
const Attendance = require("../models/attendance");

describe("Attendance", () => {
  let userA;
  let userB;
  let event;

  before(async () => {
    await connectTestDb();
    await User.syncIndexes();
    await Event.syncIndexes();
    await Attendance.syncIndexes();
  });
  after(disconnectTestDb);
  beforeEach(async () => {
    await resetTestDb();
    userA = await User.create({ name: "A", nickname: "a", email: "a@x.cz" });
    userB = await User.create({ name: "B", nickname: "b", email: "b@x.cz" });
    event = await Event.create({
      name: "E",
      startAt: new Date("2026-09-01T17:00:00.000Z"),
      endAt: new Date("2026-09-01T19:00:00.000Z"),
      location: "Hala",
      capacity: 3,
    });
  });

  it("zeros guests for no/maybe and counts occupancy only for yes", async () => {
    await Attendance.create({
      eventId: event._id,
      userId: userA._id,
      status: "no",
      guests: 4,
      note: "maybe later",
    });
    const noRow = await Attendance.findOne({ userId: userA._id });
    assert.equal(noRow.guests, 0);

    await Attendance.create({
      eventId: event._id,
      userId: userB._id,
      status: "yes",
      guests: 1,
    });
    assert.equal(await Attendance.occupiedSeats(event._id), 2);
  });

  it("rejects a second attendance for the same user and event", async () => {
    await Attendance.create({
      eventId: event._id,
      userId: userA._id,
      status: "maybe",
    });
    await assert.rejects(
      () =>
        Attendance.create({
          eventId: event._id,
          userId: userA._id,
          status: "yes",
        }),
      { name: "MongoServerError" }
    );
  });

  it("wouldExceedCapacity is true when yes+guests would pass event.capacity", async () => {
    await Attendance.create({
      eventId: event._id,
      userId: userA._id,
      status: "yes",
      guests: 1,
    });
    const over = await Attendance.wouldExceedCapacity(event._id, event.capacity, {
      status: "yes",
      guests: 1,
    });
    assert.equal(over, true);
    const ok = await Attendance.wouldExceedCapacity(event._id, event.capacity, {
      status: "yes",
      guests: 0,
    });
    assert.equal(ok, false);
  });

  it("rejects note longer than 280 characters", async () => {
    await assert.rejects(
      () =>
        Attendance.create({
          eventId: event._id,
          userId: userA._id,
          status: "yes",
          note: "x".repeat(281),
        }),
      { name: "ValidationError" }
    );
  });
});
```

- [ ] **Step 2: Run tests — they must fail**

```bash
cd server && node --test test/attendance.test.js
```

Expected: FAIL, missing `../models/attendance`.

- [ ] **Step 3: Implement Attendance**

`server/models/attendance.js`:

```javascript
const mongoose = require("mongoose");

function toJsonTransform(_doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}

const attendanceSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["yes", "no", "maybe"], required: true },
    guests: { type: Number, min: 0, max: 6, default: 0, validate: { validator: Number.isInteger, message: "guests must be an integer" } },
    note: { type: String, default: "", maxlength: 280 },
  },
  {
    timestamps: true,
    collection: "attendances",
    toJSON: { transform: toJsonTransform },
    toObject: { transform: toJsonTransform },
  }
);

attendanceSchema.index({ eventId: 1, userId: 1 }, { unique: true });

attendanceSchema.pre("validate", function (next) {
  if (this.status !== "yes") this.guests = 0;
  next();
});

attendanceSchema.statics.occupiedSeats = async function (eventId) {
  const rows = await this.find({ eventId, status: "yes" }).lean();
  return rows.reduce((sum, row) => sum + 1 + (row.guests || 0), 0);
};

attendanceSchema.statics.wouldExceedCapacity = async function (
  eventId,
  capacity,
  { status, guests = 0, excludeId } = {}
) {
  if (status !== "yes") return false;
  const query = { eventId, status: "yes" };
  if (excludeId) query._id = { $ne: excludeId };
  const rows = await this.find(query).lean();
  const current = rows.reduce((sum, row) => sum + 1 + (row.guests || 0), 0);
  return current + 1 + guests > capacity;
};

module.exports = mongoose.model("Attendance", attendanceSchema);
```

- [ ] **Step 4: Run tests — they must pass**

```bash
cd server && node --test test/attendance.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/models/attendance.js server/test/attendance.test.js
git commit -m "$(cat <<'EOF'
feat: add Attendance model with occupancy helpers

EOF
)"
```

---

### Task 5: Message model (board, one-level replies, cascade delete)

**Files:**
- Create: `server/models/message.js`
- Create: `server/test/message.test.js`

**Interfaces:**
- Consumes: `User`, `Event`
- Produces: `Message` model; `eventId` required in the sense of always present (`ObjectId` or `null`); `body` 1–2000; `replyToId` optional; `Message.createReply(parentId, fields)` rejects reply-to-reply and event mismatch; `message.deleteWithReplies()` deletes a root and its replies, or only itself if it is a reply; index `{ eventId: 1, createdAt: 1 }`

Use an instance method `deleteWithReplies` on the document.

For `eventId: null`, set the schema field `default: null` and `required: false`.

- [ ] **Step 1: Write the failing tests**

`server/test/message.test.js`:

```javascript
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const Event = require("../models/event");
const Message = require("../models/message");

describe("Message", () => {
  let author;
  let event;

  before(async () => {
    await connectTestDb();
    await Message.syncIndexes();
  });
  after(disconnectTestDb);
  beforeEach(async () => {
    await resetTestDb();
    author = await User.create({ name: "A", nickname: "a", email: "a@x.cz" });
    event = await Event.create({
      name: "E",
      startAt: new Date("2026-09-01T17:00:00.000Z"),
      endAt: new Date("2026-09-01T19:00:00.000Z"),
      location: "Hala",
      capacity: 12,
    });
  });

  it("stores board messages with eventId null", async () => {
    const msg = await Message.create({
      eventId: null,
      authorId: author._id,
      body: "hello board",
    });
    const found = await Message.findById(msg._id).lean();
    assert.equal(found.eventId, null);
  });

  it("rejects empty body and body over 2000 chars", async () => {
    await assert.rejects(
      () => Message.create({ eventId: null, authorId: author._id, body: "" }),
      { name: "ValidationError" }
    );
    await assert.rejects(
      () =>
        Message.create({
          eventId: null,
          authorId: author._id,
          body: "x".repeat(2001),
        }),
      { name: "ValidationError" }
    );
  });

  it("rejects reply to a reply and event mismatch", async () => {
    const root = await Message.create({
      eventId: event._id,
      authorId: author._id,
      body: "root",
    });
    const reply = await Message.createReply(root._id, {
      authorId: author._id,
      body: "reply",
    });
    assert.equal(String(reply.eventId), String(event._id));
    await assert.rejects(
      () => Message.createReply(reply._id, { authorId: author._id, body: "nope" }),
      /root/
    );
    const boardRoot = await Message.create({
      eventId: null,
      authorId: author._id,
      body: "board",
    });
    await assert.rejects(
      () =>
        Message.createReply(boardRoot._id, {
          authorId: author._id,
          body: "x",
          eventId: event._id,
        }),
      /eventId/
    );
  });

  it("deletes replies when deleting a root, not when deleting a reply", async () => {
    const root = await Message.create({
      eventId: null,
      authorId: author._id,
      body: "root",
    });
    const reply = await Message.createReply(root._id, {
      authorId: author._id,
      body: "reply",
    });
    await reply.deleteWithReplies();
    assert.ok(await Message.findById(root._id));
    assert.equal(await Message.findById(reply._id), null);

    const reply2 = await Message.createReply(root._id, {
      authorId: author._id,
      body: "r2",
    });
    await root.deleteWithReplies();
    assert.equal(await Message.findById(root._id), null);
    assert.equal(await Message.findById(reply2._id), null);
  });
});
```

- [ ] **Step 2: Run tests — they must fail**

```bash
cd server && node --test test/message.test.js
```

Expected: FAIL, missing `../models/message`.

- [ ] **Step 3: Implement Message**

`server/models/message.js`:

```javascript
const mongoose = require("mongoose");

function toJsonTransform(_doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}

const messageSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, minlength: 1, maxlength: 2000 },
    replyToId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: undefined },
  },
  {
    timestamps: true,
    collection: "messages",
    toJSON: { transform: toJsonTransform },
    toObject: { transform: toJsonTransform },
  }
);

messageSchema.index({ eventId: 1, createdAt: 1 });

messageSchema.statics.createReply = async function (parentId, { authorId, body, eventId } = {}) {
  const parent = await this.findById(parentId);
  if (!parent) {
    const err = new Error("parent message not found");
    err.name = "ValidationError";
    throw err;
  }
  if (parent.replyToId) {
    const err = new Error("replyToId must point at a root message");
    err.name = "ValidationError";
    throw err;
  }
  const parentEvent = parent.eventId ? String(parent.eventId) : null;
  if (eventId !== undefined) {
    const given = eventId ? String(eventId) : null;
    if (given !== parentEvent) {
      const err = new Error("reply eventId must match parent");
      err.name = "ValidationError";
      throw err;
    }
  }
  return this.create({
    eventId: parent.eventId ?? null,
    authorId,
    body,
    replyToId: parent._id,
  });
};

messageSchema.methods.deleteWithReplies = async function () {
  if (!this.replyToId) {
    await this.constructor.deleteMany({ replyToId: this._id });
  }
  await this.deleteOne();
};

module.exports = mongoose.model("Message", messageSchema);
```

- [ ] **Step 4: Run tests — they must pass**

```bash
cd server && node --test test/message.test.js
```

Expected: PASS. If `createReply` error message does not match `/root/` or `/eventId/`, keep the messages above (`root message`, `reply eventId`).

- [ ] **Step 5: Commit**

```bash
git add server/models/message.js server/test/message.test.js
git commit -m "$(cat <<'EOF'
feat: add Message model with one-level replies

EOF
)"
```

---

### Task 6: Ride model

**Files:**
- Create: `server/models/ride.js`
- Create: `server/test/ride.test.js`

**Interfaces:**
- Consumes: `User`, `Event`
- Produces: `Ride` model; unique `(eventId, driverId)`; `seats` integer ≥ 1; `passengerIds` unique, must not include `driverId`, length ≤ `seats`; `from`, `to`, `departAt` required; `note` optional

`FEATURE_RIDES` is **not** enforced in the model (endpoint plan).

- [ ] **Step 1: Write the failing tests**

`server/test/ride.test.js`:

```javascript
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const Event = require("../models/event");
const Ride = require("../models/ride");

describe("Ride", () => {
  let driver;
  let passenger;
  let other;
  let event;

  before(async () => {
    await connectTestDb();
    await Ride.syncIndexes();
  });
  after(disconnectTestDb);
  beforeEach(async () => {
    await resetTestDb();
    driver = await User.create({ name: "D", nickname: "d", email: "d@x.cz" });
    passenger = await User.create({ name: "P", nickname: "p", email: "p@x.cz" });
    other = await User.create({ name: "O", nickname: "o", email: "o@x.cz" });
    event = await Event.create({
      name: "E",
      startAt: new Date("2026-09-01T17:00:00.000Z"),
      endAt: new Date("2026-09-01T19:00:00.000Z"),
      location: "Hala",
      capacity: 12,
    });
  });

  it("rejects driver as passenger, duplicate passengers, and over seats", async () => {
    await assert.rejects(
      () =>
        Ride.create({
          eventId: event._id,
          driverId: driver._id,
          from: "A",
          to: "B",
          seats: 1,
          departAt: new Date("2026-09-01T16:00:00.000Z"),
          passengerIds: [driver._id],
        }),
      { name: "ValidationError" }
    );
    await assert.rejects(
      () =>
        Ride.create({
          eventId: event._id,
          driverId: driver._id,
          from: "A",
          to: "B",
          seats: 1,
          departAt: new Date("2026-09-01T16:00:00.000Z"),
          passengerIds: [passenger._id, passenger._id],
        }),
      { name: "ValidationError" }
    );
    await assert.rejects(
      () =>
        Ride.create({
          eventId: event._id,
          driverId: driver._id,
          from: "A",
          to: "B",
          seats: 1,
          departAt: new Date("2026-09-01T16:00:00.000Z"),
          passengerIds: [passenger._id, other._id],
        }),
      { name: "ValidationError" }
    );
  });

  it("allows one ride per driver per event", async () => {
    await Ride.create({
      eventId: event._id,
      driverId: driver._id,
      from: "A",
      to: "B",
      seats: 2,
      departAt: new Date("2026-09-01T16:00:00.000Z"),
      passengerIds: [passenger._id],
    });
    await assert.rejects(
      () =>
        Ride.create({
          eventId: event._id,
          driverId: driver._id,
          from: "X",
          to: "Y",
          seats: 2,
          departAt: new Date("2026-09-01T16:30:00.000Z"),
        }),
      { name: "MongoServerError" }
    );
  });
});
```

- [ ] **Step 2: Run tests — they must fail**

```bash
cd server && node --test test/ride.test.js
```

Expected: FAIL, missing `../models/ride`.

- [ ] **Step 3: Implement Ride**

`server/models/ride.js`:

```javascript
const mongoose = require("mongoose");

function toJsonTransform(_doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}

const rideSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    seats: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "seats must be an integer" },
    },
    departAt: { type: Date, required: true },
    note: { type: String, default: "" },
    passengerIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
      validate: [
        {
          validator(ids) {
            const strs = ids.map(String);
            return strs.length === new Set(strs).size;
          },
          message: "passengerIds must be unique",
        },
        {
          validator(ids) {
            if (!this.driverId) return true;
            return !ids.map(String).includes(String(this.driverId));
          },
          message: "driver cannot be a passenger",
        },
        {
          validator(ids) {
            return ids.length <= this.seats;
          },
          message: "no seats remaining",
        },
      ],
    },
  },
  {
    timestamps: true,
    collection: "rides",
    toJSON: { transform: toJsonTransform },
    toObject: { transform: toJsonTransform },
  }
);

rideSchema.index({ eventId: 1, driverId: 1 }, { unique: true });

module.exports = mongoose.model("Ride", rideSchema);
```

- [ ] **Step 4: Run tests — they must pass**

```bash
cd server && node --test test/ride.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/models/ride.js server/test/ride.test.js
git commit -m "$(cat <<'EOF'
feat: add Ride model

EOF
)"
```

---

### Task 7: Auth models (loginChallenge, session) and token hash

**Files:**
- Create: `server/helpers/hash-token.js`
- Create: `server/models/login-challenge.js`
- Create: `server/models/session.js`
- Create: `server/test/auth-models.test.js`

**Interfaces:**
- Consumes: `User`
- Produces: `hashToken(token: string) => string` (SHA-256 hex); `LoginChallenge` with `userId`, `tokenHash`, `expiresAt`, `consumedAt`; TTL index `{ expiresAt: 1 }` with `expireAfterSeconds: 0`; collection name `loginChallenges`; `Session` with `userId`, `tokenHash`, `lastUsedAt`; collection `sessions`; multiple sessions per user allowed (no unique on `userId`)

- [ ] **Step 1: Write the failing tests**

`server/test/auth-models.test.js`:

```javascript
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
});
```

- [ ] **Step 2: Run tests — they must fail**

```bash
cd server && node --test test/auth-models.test.js
```

Expected: FAIL, missing helper or models.

- [ ] **Step 3: Implement hash helper and models**

`server/helpers/hash-token.js`:

```javascript
const crypto = require("crypto");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = { hashToken };
```

`server/models/login-challenge.js`:

```javascript
const mongoose = require("mongoose");

function toJsonTransform(_doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}

const loginChallengeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: undefined },
  },
  {
    timestamps: true,
    collection: "loginChallenges",
    toJSON: { transform: toJsonTransform },
    toObject: { transform: toJsonTransform },
  }
);

loginChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("LoginChallenge", loginChallengeSchema);
```

`server/models/session.js`:

```javascript
const mongoose = require("mongoose");

function toJsonTransform(_doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    lastUsedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: "sessions",
    toJSON: { transform: toJsonTransform },
    toObject: { transform: toJsonTransform },
  }
);

module.exports = mongoose.model("Session", sessionSchema);
```

- [ ] **Step 4: Run all model tests**

```bash
cd server && node --test test/
```

Expected: all PASS (connect, user, event, attendance, message, ride, auth-models).

- [ ] **Step 5: Commit**

```bash
git add server/helpers/hash-token.js server/models/login-challenge.js server/models/session.js server/test/auth-models.test.js
git commit -m "$(cat <<'EOF'
feat: add login challenge and session models

EOF
)"
```

---

## Self-review (spec coverage)

| Spec item | Task |
|---|---|
| Native Mongo, `MONGODB_URI` / `MONGODB_DB` | 1 |
| Mongoose, timestamps, `id` from `_id` | 1–7 |
| `users` + seed admin | 2 |
| `events` + `endAt` > `startAt` + capacity + status | 3 |
| `attendances` unique, guests, note, guests 0 unless yes | 4 |
| Occupancy = yes + guests; exceed-capacity helper | 4 (HTTP reject = next plan) |
| `messages` `eventId: null`, one-level replies, cascade | 5 |
| `rides` unique driver/event, seats, passengerIds | 6 |
| `FEATURE_RIDES` | env in `.env.example` only; HTTP later |
| `loginChallenges` SHA-256, 30 min is endpoint concern; TTL index | 7 |
| Multiple sessions, SHA-256 | 7 |
| Permissions, SMTP, magic-link consume, bulk event API, FE theme | out of scope (next plans) |

No TBD in tasks. Names are consistent: `occupiedSeats`, `wouldExceedCapacity`, `createReply`, `deleteWithReplies`, `hashToken`, `seedAdmin`, `connectDb`.
