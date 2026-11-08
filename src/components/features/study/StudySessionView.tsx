import { ArrowLeft, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { STUDY_MODES, STUDY_MODE_LABELS } from "@/constants/vocab";
import { cn } from "@/lib/utils";
import type { FlashcardRating } from "@/lib/srs";
import type { StudyMode, Vocabulary } from "@/types/types";
import { FlashcardPanel } from "./FlashcardPanel";
import { QuizPanel } from "./QuizPanel";
import { QuizStatusCard, type QuizCard } from "./quizCards";

type StudySessionViewProps = {
  vocabulary: Vocabulary;
  currentIndex: number;
  itemCount: number;
  studyMode: StudyMode;
  quizCard: QuizCard | null;
  title: string;
  subtitle: string;
  isFlipped: boolean;
  isPending: boolean;
  feedback: "correct" | "incorrect" | null;
  onReturnToTopics: () => void;
  onModeChange: (mode: StudyMode) => void;
  onPrevious: () => void;
  onNext: () => void;
  onFlip: () => void;
  onRate: (rating: FlashcardRating) => void;
  onAnswerChange: () => void;
  onCheckAnswer: (answer: string) => void;
  onRevealAnswer: () => void;
};

export function StudySessionView({
  vocabulary,
  currentIndex,
  itemCount,
  studyMode,
  quizCard,
  title,
  subtitle,
  isFlipped,
  isPending,
  feedback,
  onReturnToTopics,
  onModeChange,
  onPrevious,
  onNext,
  onFlip,
  onRate,
  onAnswerChange,
  onCheckAnswer,
  onRevealAnswer
}: StudySessionViewProps) {
  const isLastItem = currentIndex === itemCount - 1;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 w-full flex flex-col flex-grow">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 sm:flex-wrap sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReturnToTopics}
            aria-label="Danh sách chủ đề"
            className="text-[#10b981] hover:bg-[#ECFDF5] hover:text-[#10b981] p-2 rounded-full h-11 min-w-11 shrink-0 flex items-center justify-center group font-semibold text-sm border-none"
          >
            <ArrowLeft className="w-4 h-4 sm:mr-1 group-hover:-translate-x-1 transition-transform" />
            {/* Icon-only on phones keeps the back link and mode tabs on one row, leaving room for the card. */}
            <span className="hidden sm:inline">Danh sách chủ đề</span>
          </Button>

          <div className="bg-white border border-slate-200/60 p-1 rounded-full flex gap-1 shadow-sm overflow-x-auto max-w-full">
            {STUDY_MODES.map((mode) => (
              <Button
                key={mode}
                variant="ghost"
                size="sm"
                aria-pressed={studyMode === mode}
                className={cn(
                  "rounded-full px-2.5 sm:px-4 py-1.5 h-11 sm:h-9 text-xs font-bold transition-all border-none cursor-pointer shrink-0",
                  studyMode === mode
                    ? "bg-[#10b981] text-white hover:bg-[#10b981]/90 hover:text-white shadow-sm"
                    : "text-slate-500 hover:bg-[#ECFDF5]"
                )}
                onClick={() => onModeChange(mode)}
              >
                {STUDY_MODE_LABELS[mode]}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-end gap-4 mt-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{title}</h2>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{subtitle}</span>
          </div>
          <div className="bg-[#10b981]/25 text-[#10b981] px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
            {currentIndex + 1} / {itemCount} {studyMode === "flashcard" ? "THẺ" : "CÂU"}
          </div>
        </div>

        <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-slate-200">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / itemCount) * 100}%` }}
            className="h-full bg-[#10b981] rounded-full transition-all duration-500"
          />
        </div>
      </div>

      <div className="flex-grow flex items-center justify-center relative w-full md:mt-4 md:min-h-[420px]">
        <Button
          variant="outline"
          size="icon"
          className="hidden lg:flex absolute -left-16 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center bg-white rounded-full border border-slate-200 text-[#10b981] hover:bg-[#ECFDF5] active:scale-95 transition-all shadow-[0px_4px_20px_rgba(15,23,42,0.08)] disabled:opacity-30 shrink-0"
          onClick={onPrevious}
          disabled={currentIndex === 0 || isPending}
          aria-label="Câu trước"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="w-full max-w-2xl flex-grow flex flex-col justify-center">
          {studyMode === "flashcard" ? (
            <FlashcardPanel
              vocabulary={vocabulary}
              currentIndex={currentIndex}
              isFlipped={isFlipped}
              isPending={isPending}
              onFlip={onFlip}
              onRate={onRate}
            />
          ) : quizCard?.status === "ready" ? (
            <QuizPanel
              key={`${studyMode}-${vocabulary.id}-${currentIndex}`}
              itemKey={`${studyMode}-${vocabulary.id}-${currentIndex}`}
              label={quizCard.label}
              answer={quizCard.answer}
              prompt={quizCard.prompt}
              afterAnswer={quizCard.afterAnswer}
              feedback={feedback}
              onAnswerChange={onAnswerChange}
              onCheckAnswer={onCheckAnswer}
              onRevealAnswer={onRevealAnswer}
              onNext={onNext}
            />
          ) : quizCard ? (
            <QuizStatusCard card={quizCard} onSkip={onNext} />
          ) : null}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="hidden lg:flex absolute -right-16 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center bg-white rounded-full border border-slate-200 text-[#10b981] hover:bg-[#ECFDF5] active:scale-95 transition-all shadow-[0px_4px_20px_rgba(15,23,42,0.08)] disabled:opacity-30 shrink-0"
          onClick={onNext}
          disabled={isPending}
          aria-label={isLastItem ? "Hoàn thành" : "Câu tiếp theo"}
        >
          {isLastItem ? <Check className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </Button>
      </div>

      <div className="flex lg:hidden items-center gap-3 mt-6 w-full">
        <Button
          variant="outline"
          className="flex-1 h-12 rounded-full border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-[#ECFDF5] hover:text-[#10b981] active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 flex items-center justify-center gap-1.5"
          onClick={onPrevious}
          disabled={currentIndex === 0 || isPending}
          aria-label="Câu trước"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </Button>
        <Button
          className="flex-[1.5] h-12 rounded-full bg-[#10b981] hover:bg-[#10b981]/90 text-white font-bold text-sm shadow-md shadow-[#10b981]/15 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 border-none"
          onClick={onNext}
          disabled={isPending}
          aria-label={isLastItem ? "Hoàn thành" : "Câu tiếp theo"}
        >
          <span>{isLastItem ? "Hoàn thành" : "Tiếp theo"}</span>
          {isLastItem ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>

      {isPending && (
        <span className="sr-only" role="status">
          Đang lưu đánh giá
        </span>
      )}
    </div>
  );
}
