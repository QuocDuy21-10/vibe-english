export interface NotificationVocabulary {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
}

export interface VocabularyNotificationContent {
  title: string;
  body: string;
}

export type DispatchMode = "dry-run" | "live";
export type DispatchSource = "schedule" | "manual";

export interface ResolveDispatchWindowInput {
  source: DispatchSource;
  mode: DispatchMode;
  executedAt: Date;
  eventSchedule?: string;
  manualScheduledAt?: string;
  confirmLive?: boolean;
}

export interface DispatchWindowResolution {
  action: "dispatch" | "skip" | "reject";
  mode: DispatchMode;
  source: DispatchSource;
  scheduledAt: Date | null;
  executedAt: Date;
  windowKey: string | null;
  delayMs: number | null;
  reason?:
    | "unsupported-schedule"
    | "invalid-scheduled-at"
    | "invalid-reminder-slot"
    | "manual-live-not-confirmed"
    | "scheduled-in-future"
    | "skipped-too-late";
}

const REMINDER_TIME_ZONE = "Asia/Ho_Chi_Minh";
const MAX_SCHEDULE_DELAY_MS = 90 * 60 * 1000;
const SCHEDULE_HOURS_UTC = new Map([
  ["0 1 * * *", 1],
  ["0 3 * * *", 3],
  ["0 5 * * *", 5],
  ["0 7 * * *", 7],
  ["0 9 * * *", 9],
  ["0 11 * * *", 11],
  ["0 13 * * *", 13]
]);

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: Number(value("hour")),
    minute: Number(value("minute"))
  };
}

function getWindowKey(date: Date): string | null {
  const parts = getZonedParts(date, REMINDER_TIME_ZONE);
  if (
    !Number.isInteger(parts.hour)
    || parts.hour < 8
    || parts.hour > 20
    || parts.hour % 2 !== 0
    || parts.minute !== 0
  ) {
    return null;
  }
  return `${parts.year}-${parts.month}-${parts.day}-${String(parts.hour).padStart(2, "0")}`;
}

function getLatestReminderSlot(executedAt: Date): Date {
  const parts = getZonedParts(executedAt, REMINDER_TIME_ZONE);
  const year = Number(parts.year);
  const monthIndex = Number(parts.month) - 1;
  const day = Number(parts.day);
  if (parts.hour < 8) {
    return new Date(Date.UTC(year, monthIndex, day - 1, 20 - 7, 0, 0, 0));
  }
  const localHour = Math.min(20, parts.hour - (parts.hour % 2));
  return new Date(Date.UTC(year, monthIndex, day, localHour - 7, 0, 0, 0));
}

function rejectWindow(
  input: ResolveDispatchWindowInput,
  reason: DispatchWindowResolution["reason"],
  scheduledAt: Date | null = null
): DispatchWindowResolution {
  return {
    action: "reject",
    mode: input.mode,
    source: input.source,
    scheduledAt,
    executedAt: input.executedAt,
    windowKey: scheduledAt ? getWindowKey(scheduledAt) : null,
    delayMs: scheduledAt ? input.executedAt.getTime() - scheduledAt.getTime() : null,
    reason
  };
}

export function resolveDispatchWindow(
  input: ResolveDispatchWindowInput
): DispatchWindowResolution {
  let scheduledAt: Date;

  if (input.source === "schedule") {
    const scheduledHour = input.eventSchedule
      ? SCHEDULE_HOURS_UTC.get(input.eventSchedule)
      : undefined;
    if (scheduledHour === undefined) {
      return rejectWindow(input, "unsupported-schedule");
    }
    scheduledAt = new Date(input.executedAt);
    scheduledAt.setUTCHours(scheduledHour, 0, 0, 0);
    if (scheduledAt.getTime() > input.executedAt.getTime()) {
      scheduledAt.setUTCDate(scheduledAt.getUTCDate() - 1);
    }
  } else {
    if (!input.manualScheduledAt) {
      if (input.mode === "live") return rejectWindow(input, "invalid-scheduled-at");
      scheduledAt = getLatestReminderSlot(input.executedAt);
    } else {
      scheduledAt = new Date(input.manualScheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        return rejectWindow(input, "invalid-scheduled-at");
      }
    }
    if (input.mode === "live" && input.confirmLive !== true) {
      return rejectWindow(input, "manual-live-not-confirmed", scheduledAt);
    }
  }

  const windowKey = getWindowKey(scheduledAt);
  if (!windowKey) {
    return rejectWindow(input, "invalid-reminder-slot", scheduledAt);
  }

  const delayMs = input.executedAt.getTime() - scheduledAt.getTime();
  if (delayMs < 0) {
    return rejectWindow(input, "scheduled-in-future", scheduledAt);
  }
  if (input.mode === "live" && delayMs > MAX_SCHEDULE_DELAY_MS) {
    return {
      action: "skip",
      mode: input.mode,
      source: input.source,
      scheduledAt,
      executedAt: input.executedAt,
      windowKey,
      delayMs,
      reason: "skipped-too-late"
    };
  }

  return {
    action: "dispatch",
    mode: input.mode,
    source: input.source,
    scheduledAt,
    executedAt: input.executedAt,
    windowKey,
    delayMs
  };
}

function truncate(value: string, maxLength: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxLength) return value;
  return `${characters.slice(0, maxLength - 1).join("")}…`;
}

export function formatVocabularyNotification(
  vocabulary: NotificationVocabulary
): VocabularyNotificationContent {
  const word = vocabulary.word.trim();
  const phonetic = vocabulary.phonetic.trim();
  const partOfSpeech = vocabulary.partOfSpeech.trim();
  const definition = vocabulary.definition.trim();

  return {
    title: truncate(`Từ vựng: ${word}${phonetic ? ` ${phonetic}` : ""}`, 100),
    body: truncate(`${partOfSpeech ? `${partOfSpeech} • ` : ""}${definition}`, 220)
  };
}

export function isActiveReminderHour(date: Date, timeZone: string): boolean {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).find((part) => part.type === "hour");
  const hour = Number(hourPart?.value);

  return Number.isInteger(hour) && hour >= 8 && hour <= 20 && hour % 2 === 0;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectVocabularyForWindow(
  vocabularies: NotificationVocabulary[],
  userId: string,
  windowKey: string,
  previousId: string | null
): NotificationVocabulary | null {
  if (vocabularies.length === 0) return null;

  let index = stableHash(`${userId}:${windowKey}`) % vocabularies.length;
  if (vocabularies.length > 1 && vocabularies[index].id === previousId) {
    index = (index + 1) % vocabularies.length;
  }

  return vocabularies[index];
}

const INVALID_REGISTRATION_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token"
]);

export function isInvalidRegistrationError(code: string | undefined): boolean {
  return typeof code === "string" && INVALID_REGISTRATION_CODES.has(code);
}
