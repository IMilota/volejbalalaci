export function pickNearestScheduled(events) {
  const scheduled = (Array.isArray(events) ? events : [])
    .filter((event) => event.status === "scheduled")
    .sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
  return scheduled[0] || null;
}
