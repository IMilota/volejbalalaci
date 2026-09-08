import { applySkipped, expandRecurrence, MAX_BULK_OCCURRENCES } from "./expandRecurrence";

test("expands Wednesdays 17–19 in Prague across DST", () => {
  const result = expandRecurrence({
    weekday: 3,
    from: "2026-10-01",
    to: "2026-12-31",
    startTime: "17:00",
    endTime: "19:00",
  });
  expect(result.error).toBeUndefined();
  expect(result.occurrences).toHaveLength(13);
  expect(result.occurrences[0]).toEqual({
    date: "2026-10-07",
    startAt: "2026-10-07T15:00:00.000Z",
    endAt: "2026-10-07T17:00:00.000Z",
  });
  expect(result.occurrences.at(-1)).toEqual({
    date: "2026-12-30",
    startAt: "2026-12-30T16:00:00.000Z",
    endAt: "2026-12-30T18:00:00.000Z",
  });
});

test("includes the from date when it matches the weekday", () => {
  const result = expandRecurrence({
    weekday: 3,
    from: "2026-10-07",
    to: "2026-10-07",
    startTime: "17:00",
    endTime: "19:00",
  });
  expect(result.occurrences.map((row) => row.date)).toEqual(["2026-10-07"]);
});

test("rejects an inverted range and a missing weekday match", () => {
  expect(
    expandRecurrence({
      weekday: 3,
      from: "2026-12-31",
      to: "2026-10-01",
      startTime: "17:00",
      endTime: "19:00",
    }).error
  ).toBe("range");
  expect(
    expandRecurrence({
      weekday: 1,
      from: "2026-10-07",
      to: "2026-10-07",
      startTime: "17:00",
      endTime: "19:00",
    }).error
  ).toBe("empty");
});

test("applySkipped drops omitted dates and keeps the rest in order", () => {
  const rows = [
    { date: "2026-08-05", startAt: "a", endAt: "b" },
    { date: "2026-08-12", startAt: "c", endAt: "d" },
    { date: "2026-08-19", startAt: "e", endAt: "f" },
  ];
  expect(applySkipped(rows, ["2026-08-12"]).map((row) => row.date)).toEqual([
    "2026-08-05",
    "2026-08-19",
  ]);
});

test("rejects when end is not after start or the series is too long", () => {
  expect(
    expandRecurrence({
      weekday: 3,
      from: "2026-10-07",
      to: "2026-10-07",
      startTime: "19:00",
      endTime: "17:00",
    }).error
  ).toBe("times");
  const long = expandRecurrence({
    weekday: 3,
    from: "2026-01-01",
    to: "2027-12-31",
    startTime: "17:00",
    endTime: "19:00",
  });
  expect(long.error).toBe("tooMany");
  expect(long.occurrences.length).toBeGreaterThan(MAX_BULK_OCCURRENCES);
});
