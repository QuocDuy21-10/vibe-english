import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAudioActions } from "@/routes/AudioProvider";
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

export function ListeningPrompt({ word, phonetic }: { word: string; phonetic: string }) {
  const { speak } = useAudioActions();
  const [speechUnavailable, setSpeechUnavailable] = useState(false);

  const play = () => {
    void speak(word).then((result) => {
      setSpeechUnavailable(result.status === "unsupported" || result.status === "no-english");
    });
  };

  // Speak once per card; the panel is keyed per word, so `play` only needs to run when the word changes.
  useEffect(play, [word]);

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-bold text-[#10b981] uppercase tracking-wide">Nghe và gõ từ bạn nghe được</p>
      <Button
        type="button"
        variant="outline"
        className="h-16 w-16 rounded-full border-[#10b981]/40 text-[#10b981] hover:bg-[#ECFDF5]"
        onClick={play}
        aria-label="Nghe lại"
      >
        <Volume2 className="w-7 h-7" />
      </Button>
      {speechUnavailable && (
        <p className="text-xs text-amber-600 font-medium">
          Trình duyệt không phát được âm thanh. Gợi ý phiên âm: <span className="font-bold">{phonetic || "—"}</span>
        </p>
      )}
    </div>
  );
}

function ListeningReveal({ vocabulary }: { vocabulary: Vocabulary }) {
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-bold text-slate-800 break-words">{vocabulary.definition}</p>
      <p className="text-xs text-slate-400 italic">{vocabulary.phonetic || "—"}</p>
    </div>
  );
}

export function getQuizCard({ mode, vocabulary }: GetQuizCardInput): QuizCard {
  if (mode === "listening") {
    return {
      status: "ready",
      label: "NGHE VÀ VIẾT",
      answer: vocabulary.word,
      prompt: <ListeningPrompt word={vocabulary.word} phonetic={vocabulary.phonetic} />,
      afterAnswer: <ListeningReveal vocabulary={vocabulary} />
    };
  }

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
