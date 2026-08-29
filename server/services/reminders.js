const Event = require("../models/event");
const Attendance = require("../models/attendance");
const PushSubscription = require("../models/push-subscription");
const { isPushConfigured, sendPushToUserIds } = require("./push");

const HOUR = 3600 * 1000;

async function runAttendanceReminders(now = new Date()) {
  if (!isPushConfigured()) {
    return { eventIds: [] };
  }
  const from = new Date(now.getTime() + 23 * HOUR);
  const to = new Date(now.getTime() + 25 * HOUR);
  const events = await Event.find({
    status: "scheduled",
    reminderSentAt: { $exists: false },
    startAt: { $gt: from, $lte: to },
  });
  const eventIds = [];
  for (const event of events) {
    const subscribed = await PushSubscription.distinct("userId");
    const decided = await Attendance.distinct("userId", {
      eventId: event._id,
      userId: { $in: subscribed },
      status: { $in: ["yes", "no"] },
    });
    const decidedSet = new Set(decided.map(String));
    const recipients = subscribed.filter((id) => !decidedSet.has(String(id)));
    await sendPushToUserIds(recipients, {
      type: "reminder",
      eventId: String(event._id),
      title: event.name,
      body: event.location,
    });
    event.reminderSentAt = now;
    await event.save();
    eventIds.push(String(event._id));
  }
  return { eventIds };
}

module.exports = { runAttendanceReminders };
