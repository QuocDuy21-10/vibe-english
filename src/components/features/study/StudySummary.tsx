import { motion } from "motion/react";
import { Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QUICK_QUIZ_TOPIC, SRS_REVIEW_TOPIC } from "@/constants/vocab";
import type { FlashcardRating } from "@/lib/srs";
import type { StudySession } from "@/types/types";

type StudySummaryProps = {
  studyMode: "flashcard" | "quiz";
  selectedTopic: string;
  itemCount: number;
  score: number;
  flashcardStats: Record<FlashcardRating, number>;
  ratedCount: number;
  sessionStats?: StudySession;
  onReturnToTopics: () => void;
  onRestart: () => void;
};

export function StudySummary({
  studyMode,
  selectedTopic,
  itemCount,
  score,
  flashcardStats,
  ratedCount,
  sessionStats,
  onReturnToTopics,
  onRestart
}: StudySummaryProps) {
  const displayItemCount = sessionStats ? sessionStats.initialCount : itemCount;
  const displayRatedCount = sessionStats ? sessionStats.completedCount : ratedCount;
  const displayFlashcardStats: Record<FlashcardRating, number> = sessionStats
    ? {
        again: sessionStats.againCount,
        hard: sessionStats.hardCount,
        good: sessionStats.goodCount,
        easy: sessionStats.easyCount
      }
    : flashcardStats;

  const accuracy = itemCount > 0 ? Math.round((score / itemCount) * 100) : 0;
  const isPerfect = accuracy === 100;


  return (
    <div className="max-w-2xl mx-auto py-12 text-center space-y-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[40px] p-10 shadow-xl border border-emerald-50 space-y-8"
      >
        <div className="relative">
          <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100 relative z-10">
            <Trophy className="w-12 h-12 text-white" />
          </div>
          {isPerfect && (
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-emerald-400 rounded-full blur-2xl opacity-20"
            />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">
            {isPerfect ? "Tuyệt vời! ✨" : accuracy >= 80 ? "Rất tốt! 👏" : accuracy >= 50 ? "Khá lắm! 👍" : "Cố gắng lên! 💪"}
          </h2>
          <p className="text-slate-500 font-medium">
            {selectedTopic === SRS_REVIEW_TOPIC
              ? `Bạn đã hoàn thành phiên ôn tập ${displayItemCount} từ vựng đến hạn!`
              : selectedTopic === QUICK_QUIZ_TOPIC
                ? "Bạn đã hoàn thành bài học thử thách 10 từ vựng."
                : `Bạn đã hoàn thành ${displayItemCount} từ vựng trong chủ đề này.`}
          </p>
        </div>

        {studyMode === "flashcard" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="py-5 px-3 bg-rose-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Again</p>
              <div className="text-2xl font-black text-rose-700">{displayFlashcardStats.again}</div>
            </div>
            <div className="py-5 px-3 bg-amber-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Hard</p>
              <div className="text-2xl font-black text-amber-700">{displayFlashcardStats.hard}</div>
            </div>
            <div className="py-5 px-3 bg-emerald-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Good</p>
              <div className="text-2xl font-black text-emerald-700">{displayFlashcardStats.good}</div>
            </div>
            <div className="py-5 px-3 bg-sky-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest">Easy</p>
              <div className="text-2xl font-black text-sky-700">{displayFlashcardStats.easy}</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="py-6 px-4 bg-emerald-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Độ chính xác</p>
              <div className="text-3xl font-black text-emerald-700">{accuracy}%</div>
            </div>
            <div className="py-6 px-4 bg-slate-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Số câu đúng</p>
              <div className="text-3xl font-black text-slate-700">{score}/{displayItemCount}</div>
            </div>
            <div className="py-6 px-4 bg-rose-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Cần cải thiện</p>
              <div className="text-3xl font-black text-rose-700">{Math.max(0, displayItemCount - score)}</div>
            </div>
          </div>
        )}

        {studyMode === "flashcard" && (
          <div className="py-4 px-6 bg-emerald-900 rounded-2xl text-white">
            <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Thống kê Flashcard</p>
            <div className="text-xl font-bold">{displayRatedCount} lượt đánh giá đã hoàn thành</div>
          </div>
        )}


        <div className="pt-4 space-y-3">
          <Button
            onClick={onReturnToTopics}
            className="w-full h-14 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-lg shadow-lg border-none"
          >
            Quay lại trang chủ học tập
          </Button>
          <Button
            variant="ghost"
            onClick={onRestart}
            className="w-full h-12 text-emerald-600 font-bold hover:bg-emerald-50"
          >
            Học lại ngay
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
