import { describe, expect, it } from "vitest";
import type { Vocabulary } from "@/types/types";
import {
  calculateNextSchedule,
  deriveLevel,
  isDueForReview,
  normalizeSchedule,
  requeueAgainOnce
} from "@/lib/srs";

const REVIEWED_AT = new Date("2026-07-29T10:00:00.000Z");

function legacyVocabulary(level: number, nextReview: Vocabulary["nextReview"] = REVIEWED_AT): Vocabulary {
  return {
    id: `level-${level}`,
    word: "test",
    definition: "kiểm tra",
    partOfSpeech: "verb",
    phonetic: "/test/",
    topicId: "topic",
    userId: "user",
    createdAt: REVIEWED_AT,
    updatedAt: REVIEWED_AT,
    level,
    nextReview
  };
}

describe("normalizeSchedule", () => {
  it.each([
    [0, 0, 0],
    [1, 1, 1],
    [2, 3, 2],
    [3, 7, 3],
    [4, 30, 4],
    [5, 30, 4]
  ])("maps legacy level %i to interval %i and %i repetitions", (level, intervalDays, repetitions) => {
    const schedule = normalizeSchedule(legacyVocabulary(level), REVIEWED_AT);

    expect(schedule).toMatchObject({ intervalDays, repetitions, easeFactor: 2.5, lapses: 0 });
  });

  it("makes a legacy card with no review date due immediately", () => {
    const schedule = normalizeSchedule(legacyVocabulary(4, null), REVIEWED_AT);

    expect(schedule.nextReview).toEqual(REVIEWED_AT);
  });
});

describe("calculateNextSchedule", () => {
  it.each([
    ["again", 1, 0, 1, 2.3],
    ["hard", 1, 1, 0, 2.35],
    ["good", 1, 1, 0, 2.5],
    ["easy", 4, 1, 0, 2.65]
  ] as const)("applies %s to a new card", (rating, intervalDays, repetitions, lapses, easeFactor) => {
    const result = calculateNextSchedule(normalizeSchedule(legacyVocabulary(0), REVIEWED_AT), rating, REVIEWED_AT);

    expect(result).toMatchObject({ intervalDays, repetitions, lapses, easeFactor });
  });

  it("uses a three-day interval for the second Good review", () => {
    const state = { ...normalizeSchedule(legacyVocabulary(1), REVIEWED_AT), repetitions: 1, intervalDays: 1 };

    expect(calculateNextSchedule(state, "good", REVIEWED_AT).intervalDays).toBe(3);
  });

  it.each([
    ["again", 1, 0],
    ["hard", 8, 3],
    ["good", 18, 3],
    ["easy", 23, 3]
  ] as const)("applies %s to a developing card", (rating, intervalDays, level) => {
    const state = normalizeSchedule(legacyVocabulary(3), REVIEWED_AT);

    expect(calculateNextSchedule(state, rating, REVIEWED_AT)).toMatchObject({ intervalDays, level });
  });

  it.each([
    ["again", 1, 0],
    ["hard", 36, 4],
    ["good", 75, 4],
    ["easy", 98, 4]
  ] as const)("applies %s to a mature card", (rating, intervalDays, level) => {
    const state = normalizeSchedule(legacyVocabulary(4), REVIEWED_AT);

    expect(calculateNextSchedule(state, rating, REVIEWED_AT)).toMatchObject({ intervalDays, level });
  });

  it("moves a legacy level 3 card rated Easy to a valid mature interval", () => {
    const state = normalizeSchedule(legacyVocabulary(3), REVIEWED_AT);
    const result = calculateNextSchedule(state, "easy", REVIEWED_AT);

    expect(result).toMatchObject({ intervalDays: 23, level: 3, repetitions: 4 });
  });

  it("keeps a mature card at level 4 while extending its interval", () => {
    const state = normalizeSchedule(legacyVocabulary(4), REVIEWED_AT);
    const result = calculateNextSchedule(state, "easy", REVIEWED_AT);

    expect(result).toMatchObject({ intervalDays: 98, level: 4, repetitions: 5 });
  });

  it("bounds ease and intervals", () => {
    const state = {
      ...normalizeSchedule(legacyVocabulary(4), REVIEWED_AT),
      intervalDays: 3650,
      easeFactor: 3
    };

    expect(calculateNextSchedule(state, "easy", REVIEWED_AT)).toMatchObject({
      intervalDays: 3650,
      easeFactor: 3
    });
  });

  it.each([
    ["again", 1.3],
    ["hard", 1.3],
    ["good", 1.3],
    ["easy", 1.45]
  ] as const)("respects minimum ease when rated %s", (rating, easeFactor) => {
    const state = { ...normalizeSchedule(legacyVocabulary(3), REVIEWED_AT), easeFactor: 1.3 };

    expect(calculateNextSchedule(state, rating, REVIEWED_AT).easeFactor).toBeCloseTo(easeFactor);
  });

  it.each([
    ["again", 2.8],
    ["hard", 2.85],
    ["good", 3],
    ["easy", 3]
  ] as const)("respects maximum ease when rated %s", (rating, easeFactor) => {
    const state = { ...normalizeSchedule(legacyVocabulary(3), REVIEWED_AT), easeFactor: 3 };

    expect(calculateNextSchedule(state, rating, REVIEWED_AT).easeFactor).toBeCloseTo(easeFactor);
  });

  it("resets repetitions and increments lapses after Again", () => {
    const state = { ...normalizeSchedule(legacyVocabulary(4), REVIEWED_AT), lapses: 2 };

    expect(calculateNextSchedule(state, "again", REVIEWED_AT)).toMatchObject({
      intervalDays: 1,
      repetitions: 0,
      lapses: 3,
      level: 0
    });
  });
});

describe("derived scheduling behavior", () => {
  it.each([
    [0, 0, 1],
    [1, 1, 1],
    [2, 1, 3],
    [3, 1, 7],
    [4, 1, 30]
  ])("derives level %i from repetitions %i and interval %i", (expectedLevel, repetitions, intervalDays) => {
    expect(deriveLevel({ repetitions, intervalDays })).toBe(expectedLevel);
  });

  it("includes mature cards whose review date has arrived", () => {
    const card = {
      ...legacyVocabulary(4),
      srsVersion: 1 as const,
      intervalDays: 90,
      easeFactor: 2.5,
      repetitions: 5,
      lapses: 0,
      nextReview: new Date("2026-07-28T10:00:00.000Z")
    };

    expect(isDueForReview(card, REVIEWED_AT)).toBe(true);
  });

  it("excludes cards with a future review date", () => {
    const card = {
      ...legacyVocabulary(4),
      nextReview: new Date("2026-07-30T10:00:00.000Z")
    };

    expect(isDueForReview(card, REVIEWED_AT)).toBe(false);
  });
});

describe("requeueAgainOnce", () => {
  it("appends a failed card only once per session", () => {
    const card = legacyVocabulary(0);
    const first = requeueAgainOnce([card], card, new Set());
    const second = requeueAgainOnce(first.queue, card, first.requeuedIds);

    expect(second.queue.map((item) => item.id)).toEqual([card.id, card.id]);
  });
});
