import { pickNearestScheduled } from "./pickNearestScheduled";

test("picks earliest scheduled, skips cancelled", () => {
  const a = { id: "c", startAt: "2030-01-02T10:00:00.000Z", status: "cancelled" };
  const b = { id: "s", startAt: "2030-01-03T10:00:00.000Z", status: "scheduled" };
  const c = { id: "s0", startAt: "2030-01-01T10:00:00.000Z", status: "scheduled" };
  expect(pickNearestScheduled([a, b, c]).id).toBe("s0");
});

test("returns null when none scheduled", () => {
  expect(
    pickNearestScheduled([
      { id: "c", startAt: "2030-01-01T10:00:00.000Z", status: "cancelled" },
    ])
  ).toBeNull();
});
