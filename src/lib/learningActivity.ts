import { resolveReviewDate } from "@/lib/srs";
import type { QuizAttempt, ReviewEvent } from "@/types/types";

export const ACTIVITY_WINDOW_DAYS = 70;
export const HEATMAP_WEEKS = 10;

export type ActivityItem = {
  vocabularyId: string;
  topicId: string | null;
  at: Date;
  kind: "flashcard" | "quiz";
  success: boolean;
};

export type TodayProgress = {
  count: number;
  goal: number;
  percent: number;
  remaining: number;
  accuracy: number | null;
};

export type HeatmapIntensity = 0 | 1 | 2 | 3 | 4;

export type HeatmapCell = {
  dayKey: string;
  date: Date;
  count: number;
  intensity: HeatmapIntensity;
  isToday: boolean;
  isFuture: boolean;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function startOfLocalDay(date: Date, offsetDays = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays);
}

export function formatShortDate(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}

export function toActivityItems(reviewEvents: ReviewEvent[], quizAttempts: QuizAttempt[]): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const event of reviewEvents) {
    const at = resolveReviewDate(event.reviewedAt);
    if (!at) continue;
    items.push({
      vocabularyId: event.vocabularyId,
      topicId: event.topicId ?? null,
      at,
      kind: "flashcard",
      success: event.rating !== "again"
    });
  }

  for (const attempt of quizAttempts) {
    const at = resolveReviewDate(attempt.attemptedAt);
    if (!at) continue;
    items.push({
      vocabularyId: attempt.vocabularyId,
      topicId: attempt.topicId ?? null,
      at,
      kind: "quiz",
      success: attempt.result === "correct"
    });
  }

  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function accuracyOf(items: ActivityItem[]): number | null {
  if (items.length === 0) return null;
  return Math.round((items.filter((entry) => entry.success).length / items.length) * 100);
}

export function getTodayProgress(items: ActivityItem[], goal: number, now = new Date()): TodayProgress {
  const todayKey = localDayKey(now);
  const todayItems = items.filter((entry) => localDayKey(entry.at) === todayKey);
  const count = todayItems.length;

  return {
    count,
    goal,
    percent: Math.min(100, Math.round((count / goal) * 100)),
    remaining: Math.max(0, goal - count),
    accuracy: accuracyOf(todayItems)
  };
}

export function getHeatmapIntensity(count: number, goal: number): HeatmapIntensity {
  if (count <= 0) return 0;
  const ratio = count / goal;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 1) return 3;
  return 4;
}

export function buildHeatmap(items: ActivityItem[], goal: number, now = new Date()): HeatmapCell[][] {
  const counts = new Map<string, number>();
  for (const entry of items) {
    const key = localDayKey(entry.at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const todayKey = localDayKey(now);
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const firstDayOffset = -daysSinceMonday - (HEATMAP_WEEKS - 1) * 7;

  return Array.from({ length: HEATMAP_WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const date = startOfLocalDay(now, firstDayOffset + week * 7 + weekday);
      const dayKey = localDayKey(date);
      const count = counts.get(dayKey) ?? 0;
      return {
        dayKey,
        date,
        count,
        intensity: getHeatmapIntensity(count, goal),
        isToday: dayKey === todayKey,
        isFuture: dayKey > todayKey
      };
    })
  );
}

export type DaySummary = {
  dayKey: string;
  date: Date;
  total: number;
  flashcardCount: number;
  quizCount: number;
  accuracy: number | null;
  uniqueWordCount: number;
  vocabularyIds: string[];
};

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

export function summarizeDays(items: ActivityItem[]): DaySummary[] {
  const byDay = new Map<string, ActivityItem[]>();
  for (const entry of items) {
    const key = localDayKey(entry.at);
    const dayItems = byDay.get(key);
    if (dayItems) dayItems.push(entry);
    else byDay.set(key, [entry]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dayKey, dayItems]) => {
      const ordered = [...dayItems].sort((a, b) => a.at.getTime() - b.at.getTime());
      const vocabularyIds = [...new Set(ordered.map((entry) => entry.vocabularyId))];
      return {
        dayKey,
        date: startOfLocalDay(ordered[0].at),
        total: ordered.length,
        flashcardCount: ordered.filter((entry) => entry.kind === "flashcard").length,
        quizCount: ordered.filter((entry) => entry.kind === "quiz").length,
        accuracy: accuracyOf(ordered),
        uniqueWordCount: vocabularyIds.length,
        vocabularyIds
      };
    });
}

export function formatDayLabel(date: Date, now = new Date()): string {
  const key = localDayKey(date);
  if (key === localDayKey(now)) return "Hôm nay";
  if (key === localDayKey(startOfLocalDay(now, -1))) return "Hôm qua";
  return `${WEEKDAY_LABELS[date.getDay()]}, ${formatShortDate(date)}`;
}
