import type { KeyboardEvent } from "react";
import { BookOpen, Brain, Volume2 } from "lucide-react";
import { motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { playAudio } from "@/lib/audio";
import type { FlashcardRating } from "@/lib/srs";
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
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onFlip();
  };

  return (
    <div className="relative h-[420px] perspective-1000 w-full">
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
        className="w-full h-full cursor-pointer relative rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]"
        style={{ transformStyle: "preserve-3d" }}
        onClick={onFlip}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={isFlipped ? "Ẩn nghĩa tiếng Việt" : "Hiện nghĩa tiếng Việt"}
      >
        <div className="absolute inset-0 backface-hidden w-full h-full rounded-xl bg-white border border-slate-200 p-6 flex flex-col items-center justify-center text-center shadow-[0px_4px_20px_rgba(15,23,42,0.08)] overflow-hidden">
          <div className="absolute top-6 left-6 opacity-[0.03]">
            <BookOpen className="w-32 h-32 text-slate-800" />
          </div>
          <div className="absolute top-4 left-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Flashcard Mode
          </div>

          <Badge variant="outline" className="mb-6 rounded-lg border-[#ECFDF5] bg-[#ECFDF5] text-[#006c49] text-xs font-bold uppercase tracking-wider px-3 py-1 border-none shadow-sm">
            {vocabulary.partOfSpeech || "Vocabulary"}
          </Badge>

          <div className="flex items-center gap-3 mb-2 flex-wrap justify-center">
            <h2 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight">{vocabulary.word}</h2>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full text-[#10b981] hover:bg-[#ECFDF5] hover:text-[#006c49] transition-all border-none"
              onClick={(event) => {
                event.stopPropagation();
                playAudio(vocabulary.word);
              }}
              aria-label={`Phát âm ${vocabulary.word}`}
            >
              <Volume2 className="w-6 h-6" />
            </Button>
          </div>
          <p className="text-lg font-medium text-slate-400 italic mb-10">/ {vocabulary.phonetic} /</p>

          <div className="flex items-center gap-2 text-slate-400/80 animate-pulse mt-4">
            <Brain className="w-4 h-4 text-[#10b981]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest">Nhấn để xem nghĩa tiếng Việt</span>
          </div>
        </div>

        <div
          className="absolute inset-0 backface-hidden w-full h-full rounded-xl bg-[#006c49] border border-[#006c49] p-6 flex flex-col items-center justify-center text-center shadow-[0px_4px_20px_rgba(15,23,42,0.08)]"
          style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
        >
          <div className="absolute top-6 right-6 opacity-5">
            <Brain className="w-32 h-32 text-white" />
          </div>
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-4">Nghĩa Tiếng Việt</p>
          <h3 className="text-3xl sm:text-4xl font-bold text-white leading-relaxed tracking-tight px-4 max-h-[160px] overflow-y-auto">
            {vocabulary.definition}
          </h3>

          <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-sm" onClick={(event) => event.stopPropagation()}>
            <Button
              disabled={isPending}
              className="h-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider border-none shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => onRate("again")}
            >
              Again
            </Button>
            <Button
              disabled={isPending}
              className="h-10 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider border-none shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => onRate("hard")}
            >
              Hard
            </Button>
            <Button
              disabled={isPending}
              className="h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider border-none shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => onRate("good")}
            >
              Good
            </Button>
            <Button
              disabled={isPending}
              className="h-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs uppercase tracking-wider border-none shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => onRate("easy")}
            >
              Easy
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
