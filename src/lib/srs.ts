import type { Vocabulary } from "@/types/types";

export const SRS_VERSION = 1 as const;
export const DEFAULT_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
export const MAX_EASE_FACTOR = 3;
export const MAX_INTERVAL_DAYS = 3650;

export type FlashcardRating = "again" | "hard" | "good" | "easy";

export type ScheduleState = {
  srsVersion: typeof SRS_VERSION;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  nextReview: Date;
  lastReviewedAt: Date | null;
};

export type ScheduleUpdate = ScheduleState & {
  level: number;
};

type VersionedVocabulary = Vocabulary & {
  srsVersion: typeof SRS_VERSION;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
};

const LEGACY_INTERVALS = [0, 1, 3, 7, 30] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function resolveReviewDate(value: unknown): Date | null {
  if (!value) return null;

  const date =
    typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function"
      ? value.toDate()
      : new Date(value as string | number | Date);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLegacyLevel(level: number | undefined) {
  return clamp(Math.trunc(level ?? 0), 0, 4);
}

function hasVersionedSchedule(vocabulary: Vocabulary): vocabulary is VersionedVocabulary {
  return (
    vocabulary.srsVersion === SRS_VERSION &&
    isFiniteNumber(vocabulary.intervalDays) &&
    isFiniteNumber(vocabulary.easeFactor) &&
    Number.isInteger(vocabulary.repetitions) &&
    Number.isInteger(vocabulary.lapses)
  );
}

export function normalizeSchedule(vocabulary: Vocabulary, now = new Date()): ScheduleState {
  if (!hasVersionedSchedule(vocabulary)) {
    const legacyLevel = normalizeLegacyLevel(vocabulary.level);
    return {
      srsVersion: SRS_VERSION,
      intervalDays: LEGACY_INTERVALS[legacyLevel],
      easeFactor: DEFAULT_EASE_FACTOR,
      repetitions: legacyLevel,
      lapses: 0,
      nextReview: resolveReviewDate(vocabulary.nextReview) ?? now,
      lastReviewedAt: null
    };
  }

  return {
    srsVersion: SRS_VERSION,
    intervalDays: clamp(Math.round(vocabulary.intervalDays), 0, MAX_INTERVAL_DAYS),
    easeFactor: clamp(vocabulary.easeFactor, MIN_EASE_FACTOR, MAX_EASE_FACTOR),
    repetitions: Math.max(0, Math.trunc(vocabulary.repetitions)),
    lapses: Math.max(0, Math.trunc(vocabulary.lapses)),
    nextReview: resolveReviewDate(vocabulary.nextReview) ?? now,
    lastReviewedAt: resolveReviewDate(vocabulary.lastReviewedAt)
  };
}

export function deriveLevel(state: Pick<ScheduleState, "intervalDays" | "repetitions">) {
  if (state.repetitions === 0) return 0;
  if (state.intervalDays < 3) return 1;
  if (state.intervalDays < 7) return 2;
  if (state.intervalDays < 30) return 3;
  return 4;
}

export function addReviewDays(reviewedAt: Date, intervalDays: number) {
  const nextReview = new Date(reviewedAt);
  nextReview.setDate(nextReview.getDate() + intervalDays);
  return nextReview;
}

function getIntervalDays(state: ScheduleState, rating: FlashcardRating) {
  if (rating === "again") return 1;
  if (rating === "hard") return state.repetitions === 0 ? 1 : state.intervalDays * 1.2;
  if (rating === "easy") return state.repetitions === 0 ? 4 : state.intervalDays * state.easeFactor * 1.3;
  if (state.repetitions === 0) return 1;
  if (state.repetitions === 1) return 3;
  return state.intervalDays * state.easeFactor;
}

function getEaseFactor(state: ScheduleState, rating: FlashcardRating) {
  const adjustment = rating === "again" ? -0.2 : rating === "hard" ? -0.15 : rating === "easy" ? 0.15 : 0;
  return clamp(state.easeFactor + adjustment, MIN_EASE_FACTOR, MAX_EASE_FACTOR);
}

export function calculateNextSchedule(
  state: ScheduleState,
  rating: FlashcardRating,
  reviewedAt = new Date()
): ScheduleUpdate {
  const intervalDays = clamp(Math.round(getIntervalDays(state, rating)), 1, MAX_INTERVAL_DAYS);
  const repetitions = rating === "again" ? 0 : state.repetitions + 1;
  const nextState: ScheduleState = {
    srsVersion: SRS_VERSION,
    intervalDays,
    easeFactor: getEaseFactor(state, rating),
    repetitions,
    lapses: state.lapses + (rating === "again" ? 1 : 0),
    nextReview: addReviewDays(reviewedAt, intervalDays),
    lastReviewedAt: reviewedAt
  };

  return { ...nextState, level: deriveLevel(nextState) };
}

export function isDueForReview(vocabulary: Vocabulary, now = new Date()) {
  const nextReview = resolveReviewDate(vocabulary.nextReview);
  return !nextReview || nextReview.getTime() <= now.getTime();
}

export function getVocabularyLevel(vocabulary: Vocabulary) {
  return deriveLevel(normalizeSchedule(vocabulary));
}

export function requeueAgainOnce<T extends { id: string }>(queue: T[], card: T, requeuedIds: Set<string>) {
  if (requeuedIds.has(card.id)) return { queue, requeuedIds };

  const nextRequeuedIds = new Set(requeuedIds);
  nextRequeuedIds.add(card.id);
  return {
    queue: [...queue, card],
    requeuedIds: nextRequeuedIds
  };
}
