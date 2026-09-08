import { groupMessages, toChatItems } from "./groupMessages";

test("groups one-level replies under roots", () => {
  const root = { id: "r", body: "a", replyToId: null, createdAt: "1" };
  const reply = { id: "c", body: "b", replyToId: "r", createdAt: "2" };
  const g = groupMessages([root, reply]);
  expect(g.roots.map((x) => x.id)).toEqual(["r"]);
  expect(g.repliesByParent.r.map((x) => x.id)).toEqual(["c"]);
});

test("toChatItems is chronological with parent quote, not a nested tree", () => {
  const root = { id: "r", body: "root", replyToId: null, createdAt: "2026-01-01T10:00:00.000Z" };
  const later = { id: "z", body: "later", replyToId: null, createdAt: "2026-01-01T12:00:00.000Z" };
  const reply = { id: "c", body: "reply", replyToId: "r", createdAt: "2026-01-01T11:00:00.000Z" };
  const items = toChatItems([later, reply, root]);
  expect(items.map((item) => item.message.id)).toEqual(["r", "c", "z"]);
  expect(items[1].parent).toEqual(root);
  expect(items[0].parent).toBeNull();
});
