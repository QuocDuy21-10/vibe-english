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
