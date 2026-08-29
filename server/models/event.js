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
    reminderSentAt: { type: Date, default: undefined },
  },
  {
    timestamps: true,
    collection: "events",
    toJSON: { transform: toJsonTransform },
    toObject: { transform: toJsonTransform },
  }
);

module.exports = mongoose.model("Event", eventSchema);
