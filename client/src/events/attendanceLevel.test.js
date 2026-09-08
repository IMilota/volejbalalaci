import { attendanceLevel } from "./attendanceLevel";

test("under 6 is low, 6–8 is playable, 9+ is good", () => {
  expect(attendanceLevel(0)).toBe("low");
  expect(attendanceLevel(5)).toBe("low");
  expect(attendanceLevel(6)).toBe("ok");
  expect(attendanceLevel(8)).toBe("ok");
  expect(attendanceLevel(9)).toBe("good");
  expect(attendanceLevel(12)).toBe("good");
});
