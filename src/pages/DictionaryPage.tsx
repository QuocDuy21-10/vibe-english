import { useState, useEffect } from "react";
import { Search, SearchIcon, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { VocabCard } from "@/components/features/VocabCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_TOPIC_FILTER, UNASSIGNED_TOPIC_FILTER } from "@/constants/vocab";
import { useVocabStats } from "@/hooks/useVocabStats";
import { useAppData } from "@/routes/AppDataProvider";

export function DictionaryPage() {
  const { vocabularies, topics } = useAppData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(DEFAULT_TOPIC_FILTER);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { filteredVocab, sortedTopics } = useVocabStats({
    vocabularies,
    topics,
    searchQuery,
    selectedTopicId,
  });

  const totalPages = Math.max(1, Math.ceil(filteredVocab.length / pageSize));

  // Reset page when filter configuration changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTopicId, pageSize]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedVocab = filteredVocab.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const maxVisiblePages = 5;
    const pages: (number | string)[] = [];
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Tìm kiếm từ vựng hoặc nghĩa..."
            className="pl-10 pr-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
        <Select value={selectedTopicId} onValueChange={(value) => setSelectedTopicId(value ?? DEFAULT_TOPIC_FILTER)}>
          <SelectTrigger className="w-full sm:w-55 rounded-full border-slate-200 bg-white h-11 shadow-sm">
            <SelectValue placeholder="Tất cả chủ đề" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_TOPIC_FILTER}>Tất cả bài học</SelectItem>
            <SelectItem value={UNASSIGNED_TOPIC_FILTER}>Chưa phân loại</SelectItem>
            {sortedTopics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
        <AnimatePresence mode="popLayout">
          {paginatedVocab.map((vocabulary) => (
            <VocabCard key={vocabulary.id} vocabulary={vocabulary} topics={topics} />
          ))}
        </AnimatePresence>
      </div>

      {filteredVocab.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto opacity-50">
            <Search className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-emerald-800/60 italic font-medium">Không tìm thấy từ vựng nào.</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/60 pt-6 pb-10">
          <div className="text-sm text-slate-500">
            Hiển thị <span className="font-semibold text-slate-700">{startIndex + 1}</span> -{" "}
            <span className="font-semibold text-slate-700">{Math.min(endIndex, filteredVocab.length)}</span> trong số{" "}
            <span className="font-semibold text-slate-700">{filteredVocab.length}</span> từ vựng
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-full border-slate-200 hover:bg-slate-50 transition-colors"
                title="Trang đầu"
              >
                <ChevronsLeft className="w-4 h-4 text-slate-600" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-full border-slate-200 hover:bg-slate-50 transition-colors"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </Button>

              {getPageNumbers().map((pageNum, idx) => {
                if (typeof pageNum === "string") {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 select-none">
                      {pageNum}
                    </span>
                  );
                }
                return (
                  <Button
                    key={`page-${pageNum}`}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="icon"
                    className={`w-8 h-8 rounded-full border-slate-200 transition-all font-medium text-xs ${
                      currentPage === pageNum
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-sm"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}

              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-full border-slate-200 hover:bg-slate-50 transition-colors"
                title="Trang sau"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-full border-slate-200 hover:bg-slate-50 transition-colors"
                title="Trang cuối"
              >
                <ChevronsRight className="w-4 h-4 text-slate-600" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Số từ mỗi trang:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-20 rounded-full border-slate-200 bg-white h-9 shadow-sm text-xs text-slate-700">
                <SelectValue placeholder="50" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="70">70</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
