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
