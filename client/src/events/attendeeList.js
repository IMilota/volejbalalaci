const STATUS_ORDER = { yes: 0, maybe: 1, no: 2 };

export function effectiveAttendanceStatus(status) {
  if (status === "yes" || status === "maybe") {
    return status;
  }
  return "no";
}

export function attendeeCaption(name, status, guests) {
  if (effectiveAttendanceStatus(status) === "yes" && guests > 0) {
    return `${name} (+${guests})`;
  }
  return name;
}

export function listMembers({ users, attendances, myUserId, displayName }) {
  const attByUser = new Map((attendances || []).map((row) => [row.userId, row]));
  const ids = new Set();
  for (const user of users || []) {
    ids.add(user.id);
  }
  for (const row of attendances || []) {
    ids.add(row.userId);
  }
  return [...ids]
    .map((userId) => {
      const row = attByUser.get(userId);
      return {
        userId,
        status: effectiveAttendanceStatus(row?.status),
        guests: row?.guests || 0,
      };
    })
    .sort((a, b) => {
      if (a.userId === myUserId) {
        return -1;
      }
      if (b.userId === myUserId) {
        return 1;
      }
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) {
        return byStatus;
      }
      return displayName(a.userId).localeCompare(displayName(b.userId), "cs", { sensitivity: "base" });
    });
}
