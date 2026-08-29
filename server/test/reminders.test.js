const { describe, it, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const webpush = require("web-push");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const Event = require("../models/event");
const Attendance = require("../models/attendance");
const { runAttendanceReminders } = require("../services/reminders");
const PushSubscription = require("../models/push-subscription");

const vapidKeys = webpush.generateVAPIDKeys();
const HOUR = 3600 * 1000;

function setVapid() {
  process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey;
  process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey;
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
}

function unsetVapid() {
  process.env.VAPID_PUBLIC_KEY = "";
  process.env.VAPID_PRIVATE_KEY = "";
  process.env.VAPID_SUBJECT = "";
}

describe("runAttendanceReminders", () => {
  let sendImpl = async () => {};

  before(async () => {
    mock.method(webpush, "sendNotification", (...args) => sendImpl(...args));
    await connectTestDb();
    await User.syncIndexes();
    await Event.syncIndexes();
    await Attendance.syncIndexes();
    await PushSubscription.syncIndexes();
  });
  after(async () => {
    await disconnectTestDb();
    mock.restoreAll();
  });
  beforeEach(async () => {
    sendImpl = async () => {};
    webpush.sendNotification.mock.resetCalls();
    setVapid();
    await resetTestDb();
  });

  async function makeUser(overrides = {}) {
    return User.create({
      name: "U",
      nickname: "usr",
      email: "usr@x.cz",
      role: "user",
      ...overrides,
    });
  }

  function windowEvent(now, hoursFromNow, overrides = {}) {
    return Event.create({
      name: "Úterý",
      startAt: new Date(now.getTime() + hoursFromNow * HOUR),
      endAt: new Date(now.getTime() + (hoursFromNow + 2) * HOUR),
      location: "Hala",
      capacity: 12,
      status: "scheduled",
      ...overrides,
    });
  }

  async function subscribe(user, endpoint) {
    return PushSubscription.create({
      userId: user._id,
      endpoint,
      p256dh: "BNcRdreALRPXPKOHDSDfa7qDlHUUvrqbBFA",
      auth: "tBHItJI5svbpez7KI4CCXg",
    });
  }

  it("does not target users who answered yes; a second run does not send again", async () => {
    const now = new Date("2026-08-29T10:00:00.000Z");
    const event = await windowEvent(now, 24);
    const yesUser = await makeUser();
    const maybeUser = await makeUser({ nickname: "maybe", email: "maybe@x.cz" });
    await Attendance.create({ eventId: event._id, userId: yesUser._id, status: "yes" });
    await Attendance.create({ eventId: event._id, userId: maybeUser._id, status: "maybe" });
    await subscribe(yesUser, "https://push.example/yes");
    await subscribe(maybeUser, "https://push.example/maybe");

    const first = await runAttendanceReminders(now);
    assert.deepEqual(first.eventIds, [String(event._id)]);
    const endpoints = webpush.sendNotification.mock.calls.map((call) => call.arguments[0].endpoint);
    assert.deepEqual(endpoints, ["https://push.example/maybe"]);

    const stored = await Event.findById(event._id);
    assert.ok(stored.reminderSentAt);

    webpush.sendNotification.mock.resetCalls();
    const second = await runAttendanceReminders(now);
    assert.deepEqual(second.eventIds, []);
    assert.equal(webpush.sendNotification.mock.callCount(), 0);
  });

  it("is a no-op when VAPID is unset", async () => {
    unsetVapid();
    const now = new Date("2026-08-29T10:00:00.000Z");
    const event = await windowEvent(now, 24);
    const user = await makeUser();
    await subscribe(user, "https://push.example/u");
    const result = await runAttendanceReminders(now);
    assert.deepEqual(result.eventIds, []);
    assert.equal(webpush.sendNotification.mock.callCount(), 0);
    const stored = await Event.findById(event._id);
    assert.equal(stored.reminderSentAt, undefined);
  });
});
