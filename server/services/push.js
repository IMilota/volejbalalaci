const webpush = require("web-push");
const PushSubscription = require("../models/push-subscription");

function isPushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function ensureVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function sendPushToUserIds(userIds, payload) {
  if (!isPushConfigured() || !userIds || userIds.length === 0) {
    return;
  }
  ensureVapid();
  const subscriptions = await PushSubscription.find({ userId: { $in: userIds } });
  const body = JSON.stringify(payload);
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ endpoint: sub.endpoint });
      }
    }
  }
}

module.exports = { isPushConfigured, sendPushToUserIds };
