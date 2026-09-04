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
    <div className="max-w-2xl mx-auto py-6 sm:py-12 text-center space-y-6 sm:space-y-8 w-full">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl shadow-emerald-950/5 border border-emerald-100/60 space-y-6 sm:space-y-8"
      >
        <div className="relative">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#10b981] rounded-full flex items-center justify-center mx-auto shadow-lg shadow-[#10b981]/20 relative z-10">
            <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
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
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {isPerfect ? "Tuyệt vời! ✨" : accuracy >= 80 ? "Rất tốt! 👏" : accuracy >= 50 ? "Khá lắm! 👍" : "Cố gắng lên! 💪"}
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-medium">
            {selectedTopic === SRS_REVIEW_TOPIC
              ? `Bạn đã hoàn thành phiên ôn tập ${displayItemCount} từ vựng đến hạn!`
              : selectedTopic === QUICK_QUIZ_TOPIC
                ? "Bạn đã hoàn thành bài học thử thách 10 từ vựng."
                : `Bạn đã hoàn thành ${displayItemCount} từ vựng trong chủ đề này.`}
          </p>
        </div>

        {studyMode === "flashcard" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="py-4 px-3 bg-rose-50 rounded-2xl space-y-0.5">
              <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Again</p>
              <div className="text-2xl sm:text-3xl font-black text-rose-700">{displayFlashcardStats.again}</div>
            </div>
            <div className="py-4 px-3 bg-amber-50 rounded-2xl space-y-0.5">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Hard</p>
              <div className="text-2xl sm:text-3xl font-black text-amber-700">{displayFlashcardStats.hard}</div>
            </div>
            <div className="py-4 px-3 bg-emerald-50 rounded-2xl space-y-0.5">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Good</p>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700">{displayFlashcardStats.good}</div>
            </div>
            <div className="py-4 px-3 bg-sky-50 rounded-2xl space-y-0.5">
              <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">Easy</p>
              <div className="text-2xl sm:text-3xl font-black text-sky-700">{displayFlashcardStats.easy}</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="py-4 sm:py-6 px-4 bg-emerald-50 rounded-2xl space-y-1">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Độ chính xác</p>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700">{accuracy}%</div>
            </div>
            <div className="py-4 sm:py-6 px-4 bg-slate-50 rounded-2xl space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số câu đúng</p>
              <div className="text-2xl sm:text-3xl font-black text-slate-700">{score}/{displayItemCount}</div>
            </div>
            <div className="py-4 sm:py-6 px-4 bg-rose-50 rounded-2xl space-y-1">
              <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Cần cải thiện</p>
              <div className="text-2xl sm:text-3xl font-black text-rose-700">{Math.max(0, displayItemCount - score)}</div>
            </div>
          </div>
        )}

        {studyMode === "flashcard" && (
          <div className="py-3.5 px-6 bg-[#10b981] rounded-2xl text-white text-center shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-100 mb-0.5">Thống kê Flashcard</p>
            <div className="text-base sm:text-lg font-bold">{displayRatedCount} lượt đánh giá đã hoàn thành</div>
          </div>
        )}

        <div className="pt-2 sm:pt-4 space-y-2.5">
          <Button
            onClick={onReturnToTopics}
            className="w-full h-12 sm:h-14 rounded-full bg-[#10b981] hover:bg-[#10b981]/90 text-white font-bold text-base shadow-md shadow-[#10b981]/20 border-none cursor-pointer min-h-[48px]"
          >
            Quay lại trang chủ học tập
          </Button>
          <Button
            variant="ghost"
            onClick={onRestart}
            className="w-full h-11 text-[#10b981] font-bold hover:bg-[#ECFDF5] rounded-full cursor-pointer"
          >
            Học lại ngay
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
