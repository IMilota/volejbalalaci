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

attendanceSchema.pre("validate", function () {
  if (this.status !== "yes") this.guests = 0;
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
