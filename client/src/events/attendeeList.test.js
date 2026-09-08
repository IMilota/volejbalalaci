import { attendeeCaption, effectiveAttendanceStatus, listMembers } from "./attendeeList";

test("missing or unknown status defaults to no", () => {
  expect(effectiveAttendanceStatus(undefined)).toBe("no");
  expect(effectiveAttendanceStatus("")).toBe("no");
  expect(effectiveAttendanceStatus("yes")).toBe("yes");
  expect(effectiveAttendanceStatus("maybe")).toBe("maybe");
  expect(effectiveAttendanceStatus("no")).toBe("no");
});

test("caption appends guests in parentheses only when going with guests", () => {
  expect(attendeeCaption("ivoš", "yes", 0)).toBe("ivoš");
  expect(attendeeCaption("dan", "yes", 1)).toBe("dan (+1)");
  expect(attendeeCaption("hanča", "no", 1)).toBe("hanča");
});

test("lists me first, then others sorted jdu / nevím / nejdu then name", () => {
  const names = {
    me: "Ivo",
    goingB: "Bára",
    goingA: "Adam",
    maybeZ: "Zuzana",
    missing: "Ota",
    noOne: "Nina",
  };
  const rows = listMembers({
    users: Object.keys(names).map((id) => ({ id, name: names[id] })),
    attendances: [
      { userId: "me", status: "no", guests: 0 },
      { userId: "goingB", status: "yes", guests: 0 },
      { userId: "goingA", status: "yes", guests: 2 },
      { userId: "maybeZ", status: "maybe", guests: 0 },
      { userId: "noOne", status: "no", guests: 0 },
    ],
    myUserId: "me",
    displayName: (id) => names[id],
  });
  expect(rows.map((row) => row.userId)).toEqual([
    "me",
    "goingA",
    "goingB",
    "maybeZ",
    "noOne",
    "missing",
  ]);
  expect(rows.find((row) => row.userId === "missing").status).toBe("no");
});
