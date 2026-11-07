import { describe, expect, it } from "vitest";
import {
  buildHeatmap,
  formatDayLabel,
  getHeatmapIntensity,
  getTodayProgress,
  localDayKey,
  startOfLocalDay,
  summarizeDays,
  toActivityItems,
  type ActivityItem
} from "./learningActivity";
import type { QuizAttempt, ReviewEvent } from "@/types/types";

// 2026-11-07 is a Saturday. All dates are local time.
const NOW = new Date(2026, 10, 7, 15, 0);

function item(at: Date, overrides: Partial<ActivityItem> = {}): ActivityItem {
  return { vocabularyId: "v1", topicId: null, at, kind: "flashcard", success: true, ...overrides };
}

function reviewEvent(reviewedAt: unknown, rating: ReviewEvent["rating"]): ReviewEvent {
  return {
    userId: "u",
    vocabularyId: "v1",
    rating,
    previousLevel: 0,
    newLevel: 0,
    previousIntervalDays: 0,
    newIntervalDays: 0,
    reviewedAt: reviewedAt as Date,
    topicId: "t1",
    srsVersion: 1
  };
}

function quizAttempt(attemptedAt: unknown, result: QuizAttempt["result"]): QuizAttempt {
  return { userId: "u", vocabularyId: "v2", topicId: null, result, attemptedAt: attemptedAt as Date };
}

describe("localDayKey / startOfLocalDay", () => {
  it("formats the local calendar day", () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("splits 23:59 and 00:00 into different days", () => {
    expect(localDayKey(new Date(2026, 10, 6, 23, 59))).not.toBe(localDayKey(new Date(2026, 10, 7, 0, 0)));
  });

  it("returns local midnight with an offset", () => {
    expect(startOfLocalDay(NOW, -69)).toEqual(new Date(2026, 7, 30));
  });
});

describe("toActivityItems", () => {
  it("maps flashcard ratings and quiz results to success flags, newest first", () => {
    const items = toActivityItems(
      [reviewEvent(new Date(2026, 10, 7, 9), "again"), reviewEvent(new Date(2026, 10, 7, 10), "hard")],
      [
        quizAttempt(new Date(2026, 10, 7, 11), "correct"),
        quizAttempt(new Date(2026, 10, 7, 12), "revealed"),
        quizAttempt(new Date(2026, 10, 7, 13), "incorrect")
      ]
    );

    expect(items.map((i) => [i.kind, i.success])).toEqual([
      ["quiz", false],
      ["quiz", false],
      ["quiz", true],
      ["flashcard", true],
      ["flashcard", false]
    ]);
    expect(items[4].topicId).toBe("t1");
  });

  it("accepts Firestore-like timestamps and skips missing ones", () => {
    const firestoreLike = { toDate: () => new Date(2026, 10, 7, 8) };
    const items = toActivityItems([reviewEvent(firestoreLike, "good"), reviewEvent(null, "good")], []);

    expect(items).toHaveLength(1);
    expect(items[0].at).toEqual(new Date(2026, 10, 7, 8));
  });
});

describe("getTodayProgress", () => {
  it("counts only today's actions and computes accuracy", () => {
    const items = [
      item(new Date(2026, 10, 7, 0, 0)),
      item(new Date(2026, 10, 7, 9), { success: false }),
      item(new Date(2026, 10, 7, 10)),
      item(new Date(2026, 10, 6, 23, 59))
    ];

    expect(getTodayProgress(items, 15, NOW)).toEqual({
      count: 3,
      goal: 15,
      percent: 20,
      remaining: 12,
      accuracy: 67
    });
  });

  it("caps percent at 100 and remaining at 0 when the goal is exceeded", () => {
    const items = Array.from({ length: 12 }, () => item(new Date(2026, 10, 7, 9)));

    expect(getTodayProgress(items, 10, NOW)).toMatchObject({ count: 12, percent: 100, remaining: 0 });
  });

  it("returns null accuracy with no activity today", () => {
    expect(getTodayProgress([], 15, NOW)).toEqual({ count: 0, goal: 15, percent: 0, remaining: 15, accuracy: null });
  });
});

describe("getHeatmapIntensity", () => {
  it("buckets counts by share of the goal", () => {
    expect(getHeatmapIntensity(0, 20)).toBe(0);
    expect(getHeatmapIntensity(4, 20)).toBe(1);
    expect(getHeatmapIntensity(5, 20)).toBe(2);
    expect(getHeatmapIntensity(10, 20)).toBe(3);
    expect(getHeatmapIntensity(19, 20)).toBe(3);
    expect(getHeatmapIntensity(20, 20)).toBe(4);
    expect(getHeatmapIntensity(40, 20)).toBe(4);
  });
});

describe("buildHeatmap", () => {
  it("returns 10 Monday-first weeks ending with the current week", () => {
    const weeks = buildHeatmap([], 15, NOW);

    expect(weeks).toHaveLength(10);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0].dayKey).toBe("2026-08-31");
    expect(weeks[0][0].date.getDay()).toBe(1);
    expect(weeks[9][0].dayKey).toBe("2026-11-02");
    expect(weeks[9][6].dayKey).toBe("2026-11-08");
  });

  it("marks today and future days", () => {
    const lastWeek = buildHeatmap([], 15, NOW)[9];

    expect(lastWeek[5]).toMatchObject({ dayKey: "2026-11-07", isToday: true, isFuture: false });
    expect(lastWeek[6]).toMatchObject({ dayKey: "2026-11-08", isToday: false, isFuture: true });
    expect(lastWeek[4]).toMatchObject({ isToday: false, isFuture: false });
  });

  it("counts activity per day and applies intensity", () => {
    const items = [
      ...Array.from({ length: 15 }, () => item(new Date(2026, 10, 7, 9))),
      item(new Date(2026, 10, 2, 8))
    ];
    const lastWeek = buildHeatmap(items, 15, NOW)[9];

    expect(lastWeek[5]).toMatchObject({ count: 15, intensity: 4 });
    expect(lastWeek[0]).toMatchObject({ count: 1, intensity: 1 });
    expect(lastWeek[1]).toMatchObject({ count: 0, intensity: 0 });
  });
});

describe("summarizeDays", () => {
  it("groups by local day, newest first, with counts and unique words", () => {
    const items = [
      item(new Date(2026, 10, 7, 9), { vocabularyId: "a" }),
      item(new Date(2026, 10, 7, 10), { vocabularyId: "a", success: false }),
      item(new Date(2026, 10, 7, 11), { vocabularyId: "b", kind: "quiz" }),
      item(new Date(2026, 10, 5, 23, 59), { vocabularyId: "c", kind: "quiz", success: false })
    ];

    expect(summarizeDays(items)).toEqual([
      {
        dayKey: "2026-11-07",
        date: new Date(2026, 10, 7),
        total: 3,
        flashcardCount: 2,
        quizCount: 1,
        accuracy: 67,
        uniqueWordCount: 2,
        vocabularyIds: ["a", "b"]
      },
      {
        dayKey: "2026-11-05",
        date: new Date(2026, 10, 5),
        total: 1,
        flashcardCount: 0,
        quizCount: 1,
        accuracy: 0,
        uniqueWordCount: 1,
        vocabularyIds: ["c"]
      }
    ]);
  });

  it("returns an empty list without activity", () => {
    expect(summarizeDays([])).toEqual([]);
  });
});

describe("formatDayLabel", () => {
  it("names today and yesterday, otherwise weekday and date", () => {
    expect(formatDayLabel(new Date(2026, 10, 7), NOW)).toBe("Hôm nay");
    expect(formatDayLabel(new Date(2026, 10, 6), NOW)).toBe("Hôm qua");
    expect(formatDayLabel(new Date(2026, 10, 5), NOW)).toBe("T5, 05/11");
    expect(formatDayLabel(new Date(2026, 10, 1), NOW)).toBe("CN, 01/11");
  });
});
