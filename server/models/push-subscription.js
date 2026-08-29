const mongoose = require("mongoose");

function toJsonTransform(_doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: "pushSubscriptions",
    toJSON: { transform: toJsonTransform },
    toObject: { transform: toJsonTransform },
  }
);

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
