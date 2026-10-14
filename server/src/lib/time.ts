import { addDays } from "@sentience/shared";

/** Offset in minutes of `timeZone` relative to UTC at the given instant. */
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(instant).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/** UTC instant (ISO) at local midnight of `date` in `timeZone`. */
export function zonedStartOfDay(date: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const offset = tzOffsetMinutes(guess, timeZone);
  let result = new Date(guess.getTime() - offset * 60_000);
  // Second pass handles DST transitions that happen at midnight.
  const offset2 = tzOffsetMinutes(result, timeZone);
  if (offset2 !== offset) result = new Date(guess.getTime() - offset2 * 60_000);
  return result.toISOString();
}

export function dayRange(date: string, timeZone: string): { start: string; end: string } {
  return { start: zonedStartOfDay(date, timeZone), end: zonedStartOfDay(addDays(date, 1), timeZone) };
}

/** Converts Apple Health's "2024-01-01 09:59:00 +0000" into ISO 8601. */
export function appleDateToIso(s: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/.exec(s.trim());
  if (!m) {
    const t = Date.parse(s);
    if (Number.isNaN(t)) throw new Error(`unparseable date: ${s}`);
    return new Date(t).toISOString();
  }
  return `${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`;
}

export function todayIn(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
