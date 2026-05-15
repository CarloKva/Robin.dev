import type { MaintenanceSchedule } from "@robin/shared-types";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type Weekday = (typeof WEEKDAYS)[number];

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  weekday: Weekday;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  const weekday = (parts["weekday"] ?? "sun").slice(0, 3).toLowerCase() as Weekday;
  return {
    year: Number(parts["year"]),
    month: Number(parts["month"]),
    day: Number(parts["day"]),
    weekday,
    hour: Number(parts["hour"]),
    minute: Number(parts["minute"]),
    second: Number(parts["second"]),
  };
}

function parseTimeToMinutes(value: string): number {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function previousWeekday(day: Weekday): Weekday {
  const index = WEEKDAYS.indexOf(day);
  return WEEKDAYS[(index + 6) % 7]!;
}

function isWindowActiveAt(
  window: { weekday: Weekday; start: string; end: string },
  parts: ZonedParts
): boolean {
  const start = parseTimeToMinutes(window.start);
  const end = parseTimeToMinutes(window.end);
  const current = parts.hour * 60 + parts.minute;

  if (start <= end) {
    return parts.weekday === window.weekday && current >= start && current <= end;
  }

  // Overnight window, e.g. Monday 22:00 -> Tuesday 02:00.
  return (
    (parts.weekday === window.weekday && current >= start) ||
    (previousWeekday(parts.weekday) === window.weekday && current <= end)
  );
}

function getTimeZoneOffsetMs(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - date.getTime();
}

function zonedTimeToUtc(
  parts: Pick<ZonedParts, "year" | "month" | "day" | "hour" | "minute" | "second">,
  timezone: string
): Date {
  const utcGuess = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  ));
  const firstPass = new Date(utcGuess.getTime() - getTimeZoneOffsetMs(utcGuess, timezone));
  const secondPass = new Date(utcGuess.getTime() - getTimeZoneOffsetMs(firstPass, timezone));
  return secondPass;
}

export function isInsideWindow(
  schedule: MaintenanceSchedule,
  nowUtc: Date,
  timezone: string
): boolean {
  if (schedule.mode === "disabled") return false;
  if (schedule.mode === "always_on") return true;

  const parts = getZonedParts(nowUtc, timezone);
  return schedule.windows.some((window) => isWindowActiveAt(window, parts));
}

export function nextRunAt(
  schedule: MaintenanceSchedule,
  nowUtc: Date,
  timezone: string
): Date | null {
  if (schedule.mode === "disabled") return null;

  const intervalMs =
    "interval_minutes" in schedule ? schedule.interval_minutes * 60_000 : 60 * 60_000;
  const candidate = new Date(nowUtc.getTime() + intervalMs);

  if (schedule.mode === "always_on") return candidate;
  if (isInsideWindow(schedule, candidate, timezone)) return candidate;

  // Find the next active window in bounded 5-minute increments.
  const maxSearchMs = 8 * 24 * 60 * 60 * 1000;
  const stepMs = 5 * 60 * 1000;
  for (let offset = stepMs; offset <= maxSearchMs; offset += stepMs) {
    const probe = new Date(candidate.getTime() + offset);
    if (isInsideWindow(schedule, probe, timezone)) return probe;
  }

  return null;
}

export function localDayBoundsUtc(
  nowUtc: Date,
  timezone: string
): { startUtc: Date; endUtc: Date } {
  const parts = getZonedParts(nowUtc, timezone);
  const startUtc = zonedTimeToUtc(
    { year: parts.year, month: parts.month, day: parts.day, hour: 0, minute: 0, second: 0 },
    timezone
  );
  const nextLocalDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const nextParts = getZonedParts(nextLocalDay, "UTC");
  const endUtc = zonedTimeToUtc(
    {
      year: nextParts.year,
      month: nextParts.month,
      day: nextParts.day,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timezone
  );

  return { startUtc, endUtc };
}
