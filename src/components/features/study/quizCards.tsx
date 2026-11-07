import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { StudyMode, Vocabulary } from "@/types/types";

export type QuizCard =
  | { status: "ready"; label: string; answer: string; prompt: ReactNode; afterAnswer?: ReactNode }
  | { status: "loading" }
  | { status: "error"; onRetry: () => void };

export type QuizMode = Exclude<StudyMode, "flashcard">;

type GetQuizCardInput = {
  mode: QuizMode;
  vocabulary: Vocabulary;
};

function MeaningPrompt({ definition }: { definition: string }) {
  return (
    <>
      <p className="text-xs font-bold text-[#10b981] mb-1.5 uppercase tracking-wide">NGHĨA TIẾNG VIỆT</p>
      <h3 className="text-xl sm:text-3xl font-bold text-slate-900 leading-snug break-words px-2">{definition}</h3>
    </>
  );
}

export function getQuizCard({ vocabulary }: GetQuizCardInput): QuizCard {
  return {
    status: "ready",
    label: "ĐIỀN TỪ VÀO CHỖ TRỐNG",
    answer: vocabulary.word,
    prompt: <MeaningPrompt definition={vocabulary.definition} />
  };
}

type QuizStatusCardProps = {
  card: Exclude<QuizCard, { status: "ready" }>;
  onSkip: () => void;
};

export function QuizStatusCard({ card, onSkip }: QuizStatusCardProps) {
  return (
    <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-8 flex flex-col items-center justify-center gap-4 shadow-lg shadow-emerald-950/5 min-h-[380px] sm:min-h-[420px] text-center">
      {card.status === "loading" ? (
        <div className="flex items-center gap-2 text-slate-500" role="status">
          <Loader2 className="w-5 h-5 animate-spin text-[#10b981]" />
          <span className="text-sm font-medium">Đang tạo câu ví dụ...</span>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">Không tạo được ví dụ cho từ này.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full min-h-[44px]" onClick={onSkip}>
              Bỏ qua
            </Button>
            <Button className="rounded-full min-h-[44px] bg-[#10b981] hover:bg-[#10b981]/90 text-white" onClick={card.onRetry}>
              Thử lại
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
