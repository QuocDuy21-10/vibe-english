import { describe, expect, it } from "vitest";
import type { FlashcardRating } from "@/lib/srs";
import type { ReviewEvent } from "@/types/types";
import { computeGamificationStats, toLocalDayKey } from "@/lib/gamification";

// Local time, so day keys are timezone-independent in the test runner.
const NOW = new Date(2026, 10, 7, 20, 0);

function reviewEvent(vocabularyId: string, reviewedAt: Date | null, rating: FlashcardRating = "good"): ReviewEvent {
  return {
    userId: "user",
    vocabularyId,
    rating,
    previousLevel: 0,
    newLevel: 1,
    previousIntervalDays: 0,
    newIntervalDays: 1,
    // Test-only: simulates a document whose reviewedAt is missing.
    reviewedAt: reviewedAt as unknown as Date,
    topicId: null,
    srsVersion: 1
  };
}

function dayOfReviews(day: number, count: number, rating: FlashcardRating = "good"): ReviewEvent[] {
  return Array.from({ length: count }, (_, index) =>
    reviewEvent(`word-${day}-${index}`, new Date(2026, 10, day, 9, index), rating)
  );
}

describe("toLocalDayKey", () => {
  it("pads month and day", () => {
    expect(toLocalDayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("computeGamificationStats", () => {
  it("returns zeros for no events", () => {
    const stats = computeGamificationStats([], 0, NOW);
    expect(stats).toMatchObject({
      currentStreak: 0,
      longestStreak: 0,
      todayReviewCount: 0,
      totalXp: 0,
      todayXp: 0,
      totalReviews: 0
    });
    expect(stats.nextByGroup.streak).toEqual({
      badge: { id: "streak-3", group: "streak", threshold: 3, label: "3 ngày" },
      current: 0
    });
  });

  it("does not count a day with 4 reviews", () => {
    const stats = computeGamificationStats(dayOfReviews(7, 4), 0, NOW);
    expect(stats.todayReviewCount).toBe(4);
    expect(stats.currentStreak).toBe(0);
    expect(stats.todayXp).toBe(40);
  });

  it("counts a day with 5 reviews and adds the day bonus", () => {
    const stats = computeGamificationStats(dayOfReviews(7, 5), 0, NOW);
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(1);
    expect(stats.todayXp).toBe(5 * 10 + 50);
    expect(stats.totalXp).toBe(100);
  });

  it("keeps the streak alive when today is not yet active", () => {
    const events = [...dayOfReviews(5, 5), ...dayOfReviews(6, 5), ...dayOfReviews(7, 2)];
    expect(computeGamificationStats(events, 0, NOW).currentStreak).toBe(2);
  });

  it("resets the current streak when neither today nor yesterday is active", () => {
    const stats = computeGamificationStats(dayOfReviews(5, 5), 0, NOW);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(1);
  });

  it("tracks the longest streak separately from the current one", () => {
    const events = [1, 2, 3, 6, 7].flatMap((day) => dayOfReviews(day, 5));
    const stats = computeGamificationStats(events, 0, NOW);
    expect(stats.currentStreak).toBe(2);
    expect(stats.longestStreak).toBe(3);
  });

  it("awards XP only for the earliest review of a word per day", () => {
    const events = [
      reviewEvent("apple", new Date(2026, 10, 6, 18, 0), "easy"),
      reviewEvent("apple", new Date(2026, 10, 6, 8, 0), "again"),
      reviewEvent("apple", new Date(2026, 10, 7, 8, 0), "good")
    ];
    const stats = computeGamificationStats(events, 0, NOW);
    expect(stats.totalXp).toBe(2 + 10);
    expect(stats.todayXp).toBe(10);
    expect(stats.totalReviews).toBe(3);
  });

  it("skips events without a valid reviewedAt", () => {
    const stats = computeGamificationStats([reviewEvent("apple", null)], 0, NOW);
    expect(stats.totalReviews).toBe(0);
    expect(stats.totalXp).toBe(0);
  });

  it("earns badges at the threshold and reports the next one", () => {
    const below = computeGamificationStats([], 9, NOW);
    expect(below.badges.find((badge) => badge.id === "mastered-10")?.earned).toBe(false);

    const atThreshold = computeGamificationStats([], 10, NOW);
    expect(atThreshold.badges.find((badge) => badge.id === "mastered-10")?.earned).toBe(true);
    expect(atThreshold.nextByGroup.mastered).toEqual({
      badge: { id: "mastered-50", group: "mastered", threshold: 50, label: "50 từ" },
      current: 10
    });
  });

  it("reports no next badge once a group is complete", () => {
    const stats = computeGamificationStats([], 500, NOW);
    expect(stats.badges.filter((badge) => badge.group === "mastered").every((badge) => badge.earned)).toBe(true);
    expect(stats.nextByGroup.mastered).toBeNull();
  });

  it("earns streak badges from the longest streak", () => {
    const events = [1, 2, 3].flatMap((day) => dayOfReviews(day, 5));
    const stats = computeGamificationStats(events, 0, NOW);
    expect(stats.currentStreak).toBe(0);
    expect(stats.badges.find((badge) => badge.id === "streak-3")?.earned).toBe(true);
  });
});
