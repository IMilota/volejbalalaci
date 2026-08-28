const mongoose = require("mongoose");

function toJsonTransform(_doc, ret) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}

const messageSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null, required: false },
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
