import { useMemo } from "react";
import { StudyHistory } from "@/components/features/progress/StudyHistory";
import { WeakWordsSection } from "@/components/features/progress/WeakWordsSection";
import { getWeakWords, summarizeDays } from "@/lib/learningActivity";
import { useVocabularyData } from "@/routes/AppDataProvider";
import { useLearningActivity } from "@/routes/LearningActivityProvider";

export function ProgressPage() {
  const { vocabularies } = useVocabularyData();
  const { items, isLoading } = useLearningActivity();
  const daySummaries = useMemo(() => summarizeDays(items), [items]);
  const weakWords = useMemo(() => getWeakWords(items, vocabularies), [items, vocabularies]);

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 sm:space-y-8 pb-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Tiến độ học tập</h1>
        <p className="text-slate-500 text-sm sm:text-base font-medium">
          Xem lại những gì bạn đã luyện trong 70 ngày gần đây.
        </p>
      </div>
      <WeakWordsSection weakWords={weakWords} isLoading={isLoading} />
      <StudyHistory days={daySummaries} vocabularies={vocabularies} isLoading={isLoading} />
    </div>
  );
}
