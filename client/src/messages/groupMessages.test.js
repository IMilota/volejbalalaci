import { groupMessages } from "./groupMessages";

test("groups one-level replies under roots", () => {
  const root = { id: "r", body: "a", replyToId: null, createdAt: "1" };
  const reply = { id: "c", body: "b", replyToId: "r", createdAt: "2" };
  const g = groupMessages([root, reply]);
  expect(g.roots.map((x) => x.id)).toEqual(["r"]);
  expect(g.repliesByParent.r.map((x) => x.id)).toEqual(["c"]);
});
