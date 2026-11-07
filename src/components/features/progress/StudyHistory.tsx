import { useMemo, useState } from "react";
import { ChevronDown, History, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDayLabel, type DaySummary } from "@/lib/learningActivity";
import { getPaginationModel } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { Vocabulary } from "@/types/types";

const PAGE_SIZE_OPTIONS = [10, 20, 30];

type StudyHistoryProps = {
  days: DaySummary[];
  vocabularies: Vocabulary[];
  isLoading: boolean;
};

export function StudyHistory({ days, vocabularies, isLoading }: StudyHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const vocabularyById = useMemo(() => new Map(vocabularies.map((v) => [v.id, v])), [vocabularies]);
  const pagination = useMemo(
    () => getPaginationModel(days.length, pageSize, currentPage),
    [days.length, pageSize, currentPage]
  );
  const visibleDays = days.slice(pagination.startIndex, pagination.endIndex);
  const now = new Date();

  return (
    <section aria-labelledby="study-history-heading" className="space-y-4">
      <h2 id="study-history-heading" className="flex items-center gap-2 text-lg sm:text-xl font-black text-slate-800">
        <History className="w-5 h-5 text-[#10b981]" />
        Lịch sử học
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-10" role="status" aria-label="Đang tải lịch sử học">
          <Loader2 className="h-6 w-6 animate-spin text-[#10b981]" />
        </div>
      ) : days.length === 0 ? (
        <Card className="rounded-2xl border-slate-100 shadow-sm bg-white p-6 text-center text-sm text-slate-500 font-medium">
          Chưa có hoạt động nào. Hãy bắt đầu một phiên Flashcard hoặc Quiz nhé!
        </Card>
      ) : (
        <>
          <ul className="space-y-3">
            {visibleDays.map((day) => {
              const isExpanded = expandedDay === day.dayKey;
              return (
                <li key={day.dayKey}>
                  <Card className="rounded-2xl border-slate-100 shadow-sm bg-white overflow-hidden">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedDay(isExpanded ? null : day.dayKey)}
                      className="w-full min-h-11 p-4 sm:p-5 flex items-center gap-3 text-left cursor-pointer hover:bg-[#ECFDF5]/60 transition-colors"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-bold text-slate-900">{formatDayLabel(day.date, now)}</p>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">
                          {day.total} lượt · Flashcard {day.flashcardCount} · Quiz {day.quizCount} · {day.uniqueWordCount} từ
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-[#10b981]">
                          {day.accuracy === null ? "—" : `${day.accuracy}%`}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhớ đúng</p>
                      </div>
                      <ChevronDown
                        className={cn("w-4 h-4 text-slate-400 shrink-0 transition-transform", isExpanded && "rotate-180")}
                      />
                    </button>
                    {isExpanded && (
                      <ul className="border-t border-slate-100 px-4 sm:px-5 py-3 flex flex-wrap gap-2">
                        {day.vocabularyIds.map((vocabularyId) => {
                          const vocabulary = vocabularyById.get(vocabularyId);
                          return (
                            <li key={vocabularyId}>
                              <Badge variant="secondary" className={cn(!vocabulary && "text-slate-400 italic")}>
                                {vocabulary ? vocabulary.word : "(đã xóa)"}
                              </Badge>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
          {days.length > PAGE_SIZE_OPTIONS[0] && (
            <PaginationControls
              {...pagination}
              totalItems={days.length}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              itemLabel="ngày"
              pageSizeLabel="Số ngày mỗi trang:"
              onPageChange={setCurrentPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setCurrentPage(1);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
