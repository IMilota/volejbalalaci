export const MAX_BULK_OCCURRENCES = 40;
export const PRAGUE_TZ = "Europe/Prague";

const WEEKDAY_SHORT = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function pad(value) {
  return String(value).padStart(2, "0");
}

function addCalendarDays(ymd, days) {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

function partsInZone(ms, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map = {};
  for (const part of dtf.formatToParts(new Date(ms))) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

export function zonedLocalToUtc(ymd, hm, timeZone = PRAGUE_TZ) {
  const [year, month, day] = ymd.split("-").map(Number);
  const [hour, minute] = hm.split(":").map(Number);
  let ms = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const shown = partsInZone(ms, timeZone);
    const shownMs = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, 0);
    const desiredMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = desiredMs - shownMs;
    if (delta === 0) {
      break;
    }
    ms += delta;
  }
  return new Date(ms);
}

function isoWeekdayInZone(ymd, timeZone) {
  const noon = zonedLocalToUtc(ymd, "12:00", timeZone);
  const label = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(noon);
  return WEEKDAY_SHORT[label];
}

function timeToMinutes(hm) {
  const [hour, minute] = hm.split(":").map(Number);
  return hour * 60 + minute;
}

export function expandRecurrence({
  weekday,
  from,
  to,
  startTime,
  endTime,
  timeZone = PRAGUE_TZ,
}) {
  const day = Number(weekday);
  if (!from || !to || !startTime || !endTime || !Number.isInteger(day) || day < 1 || day > 7) {
    return { occurrences: [], error: "incomplete" };
  }
  if (from > to) {
    return { occurrences: [], error: "range" };
  }
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return { occurrences: [], error: "times" };
  }

  const occurrences = [];
  for (let cursor = from; cursor <= to; cursor = addCalendarDays(cursor, 1)) {
    if (isoWeekdayInZone(cursor, timeZone) !== day) {
      continue;
    }
    occurrences.push({
      date: cursor,
      startAt: zonedLocalToUtc(cursor, startTime, timeZone).toISOString(),
      endAt: zonedLocalToUtc(cursor, endTime, timeZone).toISOString(),
    });
    if (occurrences.length > MAX_BULK_OCCURRENCES) {
      return { occurrences, error: "tooMany" };
    }
  }
  if (occurrences.length === 0) {
    return { occurrences, error: "empty" };
  }
  return { occurrences };
}

export function applySkipped(occurrences, skippedDates) {
  const skipped = new Set(skippedDates);
  return occurrences.filter((row) => !skipped.has(row.date));
}
