import { resolveReviewDate, type FlashcardRating } from "@/lib/srs";
import type { ReviewEvent } from "@/types/types";

export const STREAK_MIN_REVIEWS = 5;
export const STREAK_DAY_BONUS_XP = 50;
export const XP_BY_RATING: Record<FlashcardRating, number> = {
  again: 2,
  hard: 5,
  good: 10,
  easy: 10
};

export type BadgeGroup = "streak" | "xp" | "mastered" | "reviews";

export interface BadgeDefinition {
  id: string;
  group: BadgeGroup;
  threshold: number;
  label: string;
}

export const BADGE_GROUPS: BadgeGroup[] = ["streak", "xp", "mastered", "reviews"];

// Ascending within each group: nextByGroup relies on this order.
export const BADGES: BadgeDefinition[] = [
  { id: "streak-3", group: "streak", threshold: 3, label: "3 ngày" },
  { id: "streak-7", group: "streak", threshold: 7, label: "7 ngày" },
  { id: "streak-30", group: "streak", threshold: 30, label: "30 ngày" },
  { id: "streak-100", group: "streak", threshold: 100, label: "100 ngày" },
  { id: "xp-100", group: "xp", threshold: 100, label: "100 XP" },
  { id: "xp-1000", group: "xp", threshold: 1000, label: "1.000 XP" },
  { id: "xp-5000", group: "xp", threshold: 5000, label: "5.000 XP" },
  { id: "xp-20000", group: "xp", threshold: 20000, label: "20.000 XP" },
  { id: "mastered-10", group: "mastered", threshold: 10, label: "10 từ" },
  { id: "mastered-50", group: "mastered", threshold: 50, label: "50 từ" },
  { id: "mastered-200", group: "mastered", threshold: 200, label: "200 từ" },
  { id: "mastered-500", group: "mastered", threshold: 500, label: "500 từ" },
  { id: "reviews-100", group: "reviews", threshold: 100, label: "100 lượt" },
  { id: "reviews-500", group: "reviews", threshold: 500, label: "500 lượt" },
  { id: "reviews-2000", group: "reviews", threshold: 2000, label: "2.000 lượt" }
];

export type GamificationStats = {
  currentStreak: number;
  longestStreak: number;
  todayReviewCount: number;
  totalXp: number;
  todayXp: number;
  totalReviews: number;
  badges: Array<BadgeDefinition & { earned: boolean }>;
  nextByGroup: Record<BadgeGroup, { badge: BadgeDefinition; current: number } | null>;
};

export function toLocalDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function shiftDayKey(dayKey: string, offsetDays: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  // Calendar arithmetic (not +/-24h) so DST changes cannot skip or repeat a day.
  return toLocalDayKey(new Date(year, month - 1, day + offsetDays));
}

export function computeGamificationStats(
  events: ReviewEvent[],
  learnedVocab: number,
  now = new Date()
): GamificationStats {
  const reviewsByDay = new Map<string, number>();
  const firstReviewByDayWord = new Map<string, { dayKey: string; time: number; rating: FlashcardRating }>();
  let totalReviews = 0;

  for (const event of events) {
    const reviewedAt = resolveReviewDate(event.reviewedAt);
    if (!reviewedAt) continue;

    totalReviews += 1;
    const dayKey = toLocalDayKey(reviewedAt);
    reviewsByDay.set(dayKey, (reviewsByDay.get(dayKey) ?? 0) + 1);

    const wordKey = `${dayKey}|${event.vocabularyId}`;
    const time = reviewedAt.getTime();
    const existing = firstReviewByDayWord.get(wordKey);
    if (!existing || time < existing.time) {
      firstReviewByDayWord.set(wordKey, { dayKey, time, rating: event.rating });
    }
  }

  const xpByDay = new Map<string, number>();
  for (const { dayKey, rating } of firstReviewByDayWord.values()) {
    xpByDay.set(dayKey, (xpByDay.get(dayKey) ?? 0) + (XP_BY_RATING[rating] ?? 0));
  }

  const activeDays = new Set<string>();
  for (const [dayKey, count] of reviewsByDay) {
    if (count < STREAK_MIN_REVIEWS) continue;
    activeDays.add(dayKey);
    xpByDay.set(dayKey, (xpByDay.get(dayKey) ?? 0) + STREAK_DAY_BONUS_XP);
  }

  let longestStreak = 0;
  for (const dayKey of activeDays) {
    if (activeDays.has(shiftDayKey(dayKey, -1))) continue; // not the start of a run
    let length = 0;
    for (let cursor = dayKey; activeDays.has(cursor); cursor = shiftDayKey(cursor, 1)) {
      length += 1;
    }
    longestStreak = Math.max(longestStreak, length);
  }

  const todayKey = toLocalDayKey(now);
  let currentStreak = 0;
  for (
    let cursor = activeDays.has(todayKey) ? todayKey : shiftDayKey(todayKey, -1);
    activeDays.has(cursor);
    cursor = shiftDayKey(cursor, -1)
  ) {
    currentStreak += 1;
  }

  let totalXp = 0;
  for (const xp of xpByDay.values()) totalXp += xp;

  const metricByGroup: Record<BadgeGroup, number> = {
    streak: longestStreak,
    xp: totalXp,
    mastered: learnedVocab,
    reviews: totalReviews
  };

  const badges = BADGES.map((badge) => ({ ...badge, earned: metricByGroup[badge.group] >= badge.threshold }));
  // Narrow cast: BADGE_GROUPS lists every group, so all four keys are present.
  const nextByGroup = Object.fromEntries(
    BADGE_GROUPS.map((group) => {
      const next = BADGES.find((badge) => badge.group === group && metricByGroup[group] < badge.threshold);
      return [group, next ? { badge: next, current: metricByGroup[group] } : null];
    })
  ) as GamificationStats["nextByGroup"];

  return {
    currentStreak,
    longestStreak,
    todayReviewCount: reviewsByDay.get(todayKey) ?? 0,
    totalXp,
    todayXp: xpByDay.get(todayKey) ?? 0,
    totalReviews,
    badges,
    nextByGroup
  };
}
