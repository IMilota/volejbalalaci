const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { connectTestDb, resetTestDb, disconnectTestDb } = require("./helpers/mongo");
const User = require("../models/user");
const Event = require("../models/event");
const Message = require("../models/message");

describe("Message", () => {
  let author;
  let event;

  before(async () => {
    await connectTestDb();
    await Message.syncIndexes();
  });
  after(disconnectTestDb);
  beforeEach(async () => {
    await resetTestDb();
    author = await User.create({ name: "A", nickname: "a", email: "a@x.cz" });
    event = await Event.create({
      name: "E",
      startAt: new Date("2026-09-01T17:00:00.000Z"),
      endAt: new Date("2026-09-01T19:00:00.000Z"),
      location: "Hala",
      capacity: 12,
    });
  });

  it("stores board messages with eventId null", async () => {
    const msg = await Message.create({
      eventId: null,
      authorId: author._id,
      body: "hello board",
    });
    const found = await Message.findById(msg._id).lean();
    assert.equal(found.eventId, null);
  });

  it("rejects empty body and body over 2000 chars", async () => {
    await assert.rejects(
      () => Message.create({ eventId: null, authorId: author._id, body: "" }),
      { name: "ValidationError" }
    );
    await assert.rejects(
      () =>
        Message.create({
          eventId: null,
          authorId: author._id,
          body: "x".repeat(2001),
        }),
      { name: "ValidationError" }
    );
  });

  it("rejects reply to a reply and event mismatch", async () => {
    const root = await Message.create({
      eventId: event._id,
      authorId: author._id,
      body: "root",
    });
    const reply = await Message.createReply(root._id, {
      authorId: author._id,
      body: "reply",
    });
    assert.equal(String(reply.eventId), String(event._id));
    await assert.rejects(
      () => Message.createReply(reply._id, { authorId: author._id, body: "nope" }),
      /root/
    );
    const boardRoot = await Message.create({
      eventId: null,
      authorId: author._id,
      body: "board",
    });
    await assert.rejects(
      () =>
        Message.createReply(boardRoot._id, {
          authorId: author._id,
          body: "x",
          eventId: event._id,
        }),
      /eventId/
    );
  });

  it("deletes replies when deleting a root, not when deleting a reply", async () => {
    const root = await Message.create({
      eventId: null,
      authorId: author._id,
      body: "root",
    });
    const reply = await Message.createReply(root._id, {
      authorId: author._id,
      body: "reply",
    });
    await reply.deleteWithReplies();
    assert.ok(await Message.findById(root._id));
    assert.equal(await Message.findById(reply._id), null);

    const reply2 = await Message.createReply(root._id, {
      authorId: author._id,
      body: "r2",
    });
    await root.deleteWithReplies();
    assert.equal(await Message.findById(root._id), null);
    assert.equal(await Message.findById(reply2._id), null);
  });
});
