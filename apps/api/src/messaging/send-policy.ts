export interface PolicyInput {
  now: Date;
  timezone: string;
  hourlyLimit: number;
  dailyLimit: number;
  quietStartHour: number;
  quietEndHour: number;
  sentLastHour: number;
  sentToday: number;
  nextSendAt: Date | null;
  paused: boolean;
}

export type Decision =
  | { ok: true }
  | { ok: false; reason: "paused" | "quiet_hours" | "hourly_limit" | "daily_limit" | "cooldown"; retryAt?: Date };

export function localHour(now: Date, timezone: string): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(now);
  return Number(h) % 24;
}

/** UTC instant of 00:00 local time for the day containing `now`. */
export function startOfLocalDay(now: Date, timezone: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(now).map((p) => [p.type, p.value]),
  );
  const localAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset);
}

export function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/** Decides whether one message may be sent right now. Pure so it can be tested without a clock or a database. */
export function decide(i: PolicyInput): Decision {
  if (i.paused) return { ok: false, reason: "paused" };
  if (inQuietHours(localHour(i.now, i.timezone), i.quietStartHour, i.quietEndHour)) return { ok: false, reason: "quiet_hours" };
  if (i.sentToday >= i.dailyLimit) return { ok: false, reason: "daily_limit" };
  if (i.sentLastHour >= i.hourlyLimit) return { ok: false, reason: "hourly_limit" };
  if (i.nextSendAt && i.nextSendAt.getTime() > i.now.getTime()) return { ok: false, reason: "cooldown", retryAt: i.nextSendAt };
  return { ok: true };
}

/** Random gap before the next send: the hourly average, spread 0.6x to 1.4x so the rhythm is not mechanical. */
export function nextGapMs(hourlyLimit: number, rand: () => number = Math.random): number {
  const base = 3_600_000 / Math.max(1, hourlyLimit);
  return Math.round(base * (0.6 + rand() * 0.8));
}

/** How long to show "typing…" before sending, proportional to the message length. */
export function typingDelayMs(length: number, rand: () => number = Math.random): number {
  const ms = 800 + length * 35 + rand() * 700;
  return Math.round(Math.min(9000, Math.max(1500, ms)));
}
