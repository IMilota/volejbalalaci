/** Volleyball: 6 is the floor, 6–8 is playable, 9+ is great (12 is a full game). */
export function attendanceLevel(occupied) {
  const count = Number(occupied);
  const n = Number.isFinite(count) ? count : 0;
  if (n < 6) {
    return "low";
  }
  if (n <= 8) {
    return "ok";
  }
  return "good";
}
