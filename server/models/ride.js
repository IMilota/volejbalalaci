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
