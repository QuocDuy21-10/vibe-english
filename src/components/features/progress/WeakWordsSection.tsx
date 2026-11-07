import { Link } from "react-router-dom";
import { Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WeakWord } from "@/lib/learningActivity";
import { cn } from "@/lib/utils";

type WeakWordsSectionProps = {
  weakWords: WeakWord[];
  isLoading: boolean;
};

export function WeakWordsSection({ weakWords, isLoading }: WeakWordsSectionProps) {
  return (
    <section aria-labelledby="weak-words-heading" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h2 id="weak-words-heading" className="flex items-center gap-2 text-lg sm:text-xl font-black text-slate-800">
            <RotateCcw className="w-5 h-5 text-amber-500" />
            Từ hay quên
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Từ bạn chọn "Again" hoặc trả lời sai Quiz từ 2 lần trở lên trong 30 ngày qua.
          </p>
        </div>
        {weakWords.length > 0 && (
          <Link
            to="/study"
            className={cn(buttonVariants(), "h-11 px-5 rounded-full font-bold bg-[#10b981] hover:bg-[#10b981]/90 self-start sm:self-auto")}
          >
            Luyện bằng Flashcard
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10" role="status" aria-label="Đang tải từ hay quên">
          <Loader2 className="h-6 w-6 animate-spin text-[#10b981]" />
        </div>
      ) : weakWords.length === 0 ? (
        <Card className="rounded-2xl border-slate-100 shadow-sm bg-white p-6 text-center text-sm text-slate-500 font-medium">
          Chưa có từ nào hay quên 👏
        </Card>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {weakWords.map(({ vocabulary, failureCount }) => (
            <li key={vocabulary.id}>
              <Card className="h-full rounded-2xl border-slate-100 shadow-sm bg-white p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-bold text-slate-900 truncate">{vocabulary.word}</p>
                  <p className="text-sm text-slate-500 line-clamp-2">{vocabulary.definition}</p>
                </div>
                <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-amber-700">
                  {failureCount} lỗi / 30 ngày
                </Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
