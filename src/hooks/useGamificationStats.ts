import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { computeGamificationStats } from "@/lib/gamification";
import { getReviewEventsSince } from "@/services/reviewEventRepository";
import type { ReviewEvent } from "@/types/types";

const ALL_TIME = new Date(0);

export function useGamificationStats(userId: string | undefined, learnedVocab: number) {
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    // Repository already reports the failure via handleFirestoreError; here we only surface it.
    getReviewEventsSince(userId, ALL_TIME)
      .then((result) => {
        if (!cancelled) setEvents(result);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        toast.error("Không thể tải streak và XP. Vui lòng thử lại sau.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const stats = useMemo(() => computeGamificationStats(events, learnedVocab, new Date()), [events, learnedVocab]);

  return { loading, error, stats };
}
