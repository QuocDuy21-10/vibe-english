import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/routes/AppDataProvider";
import { useAudioActions } from "@/routes/AudioProvider";
import { generateWordUsages, getWordUsage, isWordUsageStale } from "@/services/wordUsageRepository";
import type { Vocabulary, WordUsage } from "@/types/types";

type WordUsageDialogProps = {
  vocabulary: Vocabulary;
};

type LoadState = { status: "loading" } | { status: "ready"; usage: WordUsage } | { status: "error" };

export function WordUsageDialog({ vocabulary }: WordUsageDialogProps) {
  const { user } = useAuth();
  const { speak } = useAudioActions();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const userId = user?.uid ?? null;

  const load = useCallback(
    async (forceRegenerate: boolean, isCancelled: () => boolean = () => false) => {
      if (!userId) return;
      setState({ status: "loading" });
      try {
        const cached = forceRegenerate ? null : await getWordUsage(vocabulary.id);
        const usage =
          cached && !isWordUsageStale(cached, vocabulary)
            ? cached
            : (await generateWordUsages([vocabulary], userId))[0];
        if (!isCancelled()) setState({ status: "ready", usage });
      } catch (error) {
        if (isCancelled()) return;
        setState({ status: "error" });
        toast.error(error instanceof Error ? error.message : "Không thể tạo ví dụ. Vui lòng thử lại.");
      }
    },
    [userId, vocabulary]
  );

  useEffect(() => {
    let cancelled = false;
    void load(false, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const isLoading = state.status === "loading";

  return (
    <DialogContent className="sm:max-w-lg rounded-3xl border-none shadow-2xl max-h-[85dvh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="pr-10 break-words">Ví dụ &amp; collocations: {vocabulary.word}</DialogTitle>
        <DialogDescription>{vocabulary.definition}</DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500" role="status">
            <Loader2 className="w-5 h-5 animate-spin text-[#10b981]" />
            <span className="text-sm font-medium">Đang tạo ví dụ...</span>
          </div>
        )}

        {state.status === "error" && (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-slate-500">Không tạo được ví dụ cho từ này.</p>
            <Button variant="outline" className="rounded-full h-11 px-5" onClick={() => void load(false)}>
              Thử lại
            </Button>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Collocations</h3>
              {state.usage.collocations.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Chưa có collocation.</p>
              ) : (
                <ul className="space-y-1.5">
                  {state.usage.collocations.map((collocation) => (
                    <li key={collocation.phrase} className="rounded-xl bg-[#ECFDF5] px-3 py-2">
                      <p className="text-sm font-bold text-[#065F46] break-words">{collocation.phrase}</p>
                      <p className="text-xs text-slate-600 break-words">{collocation.meaning}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Câu ví dụ</h3>
              {state.usage.examples.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Chưa có câu ví dụ.</p>
              ) : (
                <ul className="space-y-2">
                  {state.usage.examples.map((example) => (
                    <li key={example.sentence} className="flex items-start gap-2 rounded-xl border border-slate-100 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 break-words">{example.sentence}</p>
                        <p className="text-xs text-slate-500 break-words">{example.translation}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full text-[#10b981] hover:bg-[#ECFDF5] shrink-0"
                        onClick={() => void speak(example.sentence)}
                        aria-label={`Phát âm câu: ${example.sentence}`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      <Button
        variant="outline"
        className="w-full h-11 rounded-full font-bold"
        disabled={isLoading || !userId}
        onClick={() => void load(true)}
      >
        <RefreshCw className="w-4 h-4 mr-2" /> Tạo lại
      </Button>
    </DialogContent>
  );
}
