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
