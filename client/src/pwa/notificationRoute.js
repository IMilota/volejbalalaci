export function notificationPath(data = {}) {
  if (data.type === "message" && (data.eventId == null || data.eventId === "")) {
    return "/events";
  }
  if (data.type === "message" && data.eventId) {
    return "/events/" + data.eventId;
  }
  if (data.type === "reminder" && data.eventId) {
    return "/events/" + data.eventId;
  }
  return "/";
}
