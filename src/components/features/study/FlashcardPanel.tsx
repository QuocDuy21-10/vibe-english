import type { KeyboardEvent } from "react";
import { BookOpen, Brain, Volume2 } from "lucide-react";
import { motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FlashcardRating } from "@/lib/srs";
import { useAudio } from "@/routes/AudioProvider";
import type { Vocabulary } from "@/types/types";

type FlashcardPanelProps = {
  vocabulary: Vocabulary;
  currentIndex: number;
  isFlipped: boolean;
  isPending: boolean;
  onFlip: () => void;
  onRate: (rating: FlashcardRating) => void;
};

export function FlashcardPanel({
  vocabulary,
  currentIndex,
  isFlipped,
  isPending,
  onFlip,
  onRate
}: FlashcardPanelProps) {
  const { speak } = useAudio();
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onFlip();
  };

  return (
    <div className="relative min-h-[380px] sm:min-h-[420px] h-[380px] sm:h-[420px] perspective-1000 w-full">
      <motion.div
        key={`${vocabulary.id}-${currentIndex}`}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          rotateY: isFlipped ? 180 : 0
        }}
        transition={{
          opacity: { duration: 0.3 },
          rotateY: { duration: 0.6, type: "spring", stiffness: 260, damping: 25 },
          y: { duration: 0.4, type: "spring" }
        }}
        className="w-full h-full cursor-pointer relative rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] touch-manipulation select-none"
        style={{ transformStyle: "preserve-3d" }}
        onClick={onFlip}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={isFlipped ? "Ẩn nghĩa tiếng Việt" : "Hiện nghĩa tiếng Việt"}
      >
        {/* Front of Card */}
        <div className="absolute inset-0 backface-hidden w-full h-full rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-lg shadow-emerald-950/5 overflow-hidden">
          <div className="absolute top-6 left-6 opacity-[0.03] pointer-events-none">
            <BookOpen className="w-32 h-32 text-slate-800" />
          </div>
          <div className="absolute top-4 left-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
            Flashcard
          </div>

          <Badge variant="outline" className="mb-4 sm:mb-6 rounded-lg border-none bg-[#ECFDF5] text-[#10b981] text-xs font-bold uppercase tracking-wider px-3 py-1 shadow-xs">
            {vocabulary.partOfSpeech || "Vocabulary"}
          </Badge>

          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap justify-center max-w-full">
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight break-words max-w-full">
              {vocabulary.word}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="w-11 h-11 min-w-[44px] rounded-full text-[#10b981] hover:bg-[#ECFDF5] hover:text-[#10b981] transition-all border-none shrink-0"
              onClick={(event) => {
                event.stopPropagation();
                void speak(vocabulary.word);
              }}
              aria-label={`Phát âm ${vocabulary.word}`}
            >
              <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          </div>

          <p className="text-base sm:text-lg font-medium text-slate-400 italic mb-6 sm:mb-8 break-words">
            {vocabulary.phonetic || "—"}
          </p>

          <div className="flex items-center gap-2 text-slate-400/90 animate-pulse mt-2">
            <Brain className="w-4 h-4 text-[#10b981]" />
            <span className="text-xs font-semibold uppercase tracking-wider">Chạm để xem nghĩa tiếng Việt</span>
          </div>
        </div>

        {/* Back of Card */}
        <div
          className="absolute inset-0 backface-hidden w-full h-full rounded-3xl bg-[#10b981] border border-[#10b981] p-5 sm:p-8 flex flex-col items-center justify-between text-center shadow-xl shadow-emerald-950/20"
          style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
        >
          <div className="absolute top-6 right-6 opacity-5 pointer-events-none">
            <Brain className="w-32 h-32 text-white" />
          </div>

          <div className="w-full">
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1 mb-2">Nghĩa Tiếng Việt</p>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-snug tracking-tight px-2 max-h-[140px] sm:max-h-[160px] overflow-y-auto break-words">
              {vocabulary.definition}
            </h3>
          </div>

          {/* 2x2 Grid Rating Buttons */}
          <div className="w-full max-w-sm grid grid-cols-2 gap-2.5 sm:gap-3 mt-auto" onClick={(event) => event.stopPropagation()}>
            <Button
              disabled={isPending}
              className="h-12 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs sm:text-sm uppercase tracking-wider border-none shadow-md shadow-rose-950/20 active:scale-95 transition-all cursor-pointer min-h-[48px]"
              onClick={() => onRate("again")}
            >
              Again (Quên)
            </Button>
            <Button
              disabled={isPending}
              className="h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm uppercase tracking-wider border-none shadow-md shadow-amber-950/20 active:scale-95 transition-all cursor-pointer min-h-[48px]"
              onClick={() => onRate("hard")}
            >
              Hard (Khó)
            </Button>
            <Button
              disabled={isPending}
              className="h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm uppercase tracking-wider border-none shadow-md shadow-emerald-950/20 active:scale-95 transition-all cursor-pointer min-h-[48px]"
              onClick={() => onRate("good")}
            >
              Good (Nhớ)
            </Button>
            <Button
              disabled={isPending}
              className="h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs sm:text-sm uppercase tracking-wider border-none shadow-md shadow-sky-950/20 active:scale-95 transition-all cursor-pointer min-h-[48px]"
              onClick={() => onRate("easy")}
            >
              Easy (Dễ)
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
