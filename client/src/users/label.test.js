import { attendeeLabel } from "./label";

test("prefers nickname over name", () => {
  expect(attendeeLabel({ name: "Ivo Milota", nickname: "ivo" }, "u1")).toBe("ivo");
});

test("falls back to name when nickname is missing", () => {
  expect(attendeeLabel({ name: "Ivo Milota", nickname: "" }, "u1")).toBe("Ivo Milota");
  expect(attendeeLabel({ name: "Ivo Milota" }, "u1")).toBe("Ivo Milota");
});

test("falls back to a short id when both are missing", () => {
  expect(attendeeLabel({}, "abcdefghij")).toBe("abcdefgh");
});
