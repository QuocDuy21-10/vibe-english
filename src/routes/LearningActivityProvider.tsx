import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DEFAULT_DAILY_GOAL } from "@/constants/vocab";
import { ACTIVITY_WINDOW_DAYS, startOfLocalDay, toActivityItems, type ActivityItem } from "@/lib/learningActivity";
import { subscribeQuizAttemptsSince } from "@/services/quizAttemptRepository";
import { subscribeReviewEventsSince } from "@/services/reviewEventRepository";
import { subscribeUserSettings } from "@/services/userSettingsRepository";
import type { QuizAttempt, ReviewEvent } from "@/types/types";
import { useAuth } from "./AppDataProvider";

export type LearningActivityContextValue = {
  items: ActivityItem[];
  dailyGoal: number;
  isLoading: boolean;
  hasError: boolean;
};

const LearningActivityContext = createContext<LearningActivityContextValue | null>(null);

export function LearningActivityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.uid;
  const [reviewEvents, setReviewEvents] = useState<ReviewEvent[] | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[] | null>(null);
  const [dailyGoal, setDailyGoalValue] = useState(DEFAULT_DAILY_GOAL);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    // shortcut: window start is fixed at mount, so a tab left open for days shifts the oldest heatmap column; remount fixes it.
    const since = startOfLocalDay(new Date(), -(ACTIVITY_WINDOW_DAYS - 1));
    const handleError = () => {
      setHasError(true);
      toast.error("Không thể tải dữ liệu tiến độ học.", { id: "learning-activity-error" });
    };
    const unsubscribers = [
      subscribeReviewEventsSince(userId, since, setReviewEvents, handleError),
      subscribeQuizAttemptsSince(userId, since, setQuizAttempts, handleError),
      subscribeUserSettings(
        userId,
        (settings) => setDailyGoalValue(settings?.dailyGoal ?? DEFAULT_DAILY_GOAL),
        handleError
      )
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [userId]);

  const items = useMemo(
    () => toActivityItems(reviewEvents ?? [], quizAttempts ?? []),
    [reviewEvents, quizAttempts]
  );
  const isLoading = !hasError && (reviewEvents === null || quizAttempts === null);

  const value = useMemo<LearningActivityContextValue>(
    () => ({ items, dailyGoal, isLoading, hasError }),
    [items, dailyGoal, isLoading, hasError]
  );

  return <LearningActivityContext.Provider value={value}>{children}</LearningActivityContext.Provider>;
}

export function useLearningActivity() {
  const context = useContext(LearningActivityContext);
  if (!context) {
    throw new Error("useLearningActivity must be used within LearningActivityProvider");
  }
  return context;
}
