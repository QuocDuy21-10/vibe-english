import { useState, useEffect } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Edit3, SearchIcon, Trash2, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { toast } from "sonner";
import { TopicDialog } from "@/components/features/TopicDialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_TOPIC_FILTER } from "@/constants/vocab";
import { useVocabStats } from "@/hooks/useVocabStats";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { db } from "@/lib/firebase";
import { useAppData } from "@/routes/AppDataProvider";
import { OperationType } from "@/types/types";

export function TopicsPage() {
  const { topics, user, vocabularies } = useAppData();
  const [topicSearchQuery, setTopicSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const { topicVocabCounts } = useVocabStats({
    vocabularies,
    topics,
    searchQuery: "",
    selectedTopicId: DEFAULT_TOPIC_FILTER,
  });

  // Reset page when filter configuration changes
  useEffect(() => {
    setCurrentPage(1);
  }, [topicSearchQuery, pageSize]);

  if (!user) {
    return null;
  }

  const filteredTopics = topics.filter((topic) =>
    topic.name.toLowerCase().includes(topicSearchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredTopics.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTopics = filteredTopics.slice(startIndex, endIndex);

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
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Tìm kiếm chủ đề..."
          className="pl-10 pr-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm h-11"
          value={topicSearchQuery}
          onChange={(e) => setTopicSearchQuery(e.target.value)}
        />
        {topicSearchQuery && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
            onClick={() => setTopicSearchQuery("")}
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {paginatedTopics.map((topic) => (
          <Card
            key={topic.id}
            className="rounded-3xl border-slate-100 bg-white shadow-sm hover:shadow-md transition-all group overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 opacity-50 group-hover:bg-emerald-100 transition-colors"></div>
            <CardHeader className="pb-2 relative">
              <CardTitle className="text-xl font-bold text-slate-800 tracking-tight">{topic.name}</CardTitle>
              <CardDescription className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                {topicVocabCounts.get(topic.id) ?? 0} TỪ VỰNG
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-end gap-2 pt-2 relative">
              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 h-8 px-2 hover:text-emerald-600 hover:bg-emerald-50"
                    />
                  }
                >
                  <Edit3 className="w-4 h-4" />
                </DialogTrigger>
                <TopicDialog topic={topic} userId={user.uid} />
              </Dialog>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 h-8 px-2 hover:text-destructive hover:bg-rose-50"
                onClick={async () => {
                  if (
                    confirm(
                      "Xóa chủ đề này sẽ không xóa từ vựng, chúng sẽ được chuyển sang 'Chưa phân loại'. Bạn có chắc chắn?"
                    )
                  ) {
                    try {
                      await deleteDoc(doc(db, "topics", topic.id));
                      toast.success("Đã xóa chủ đề.");
                    } catch (error) {
                      handleFirestoreError(error, OperationType.DELETE, `topics/${topic.id}`);
                      toast.error("Lỗi khi xóa chủ đề.");
                    }
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
        {topics.length === 0 && (
          <div className="col-span-full py-20 text-center text-emerald-800/60 italic">
            Chưa có chủ đề nào. Hãy tạo chủ đề ngay!
          </div>
        )}
      </div>

      {filteredTopics.length === 0 && topics.length > 0 ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto opacity-50">
            <Search className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-emerald-800/60 italic font-medium">Không tìm thấy chủ đề nào phù hợp.</p>
        </div>
      ) : (
        topics.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/60 pt-6 pb-10">
            <div className="text-sm text-slate-500">
              Hiển thị <span className="font-semibold text-slate-700">{startIndex + 1}</span> -{" "}
              <span className="font-semibold text-slate-700">{Math.min(endIndex, filteredTopics.length)}</span> trong số{" "}
              <span className="font-semibold text-slate-700">{filteredTopics.length}</span> chủ đề
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
              <span className="text-xs text-slate-500">Số chủ đề mỗi trang:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-20 rounded-full border-slate-200 bg-white h-9 shadow-sm text-xs text-slate-700">
                  <SelectValue placeholder="12" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="18">18</SelectItem>
                  <SelectItem value="24">24</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )
      )}
    </div>
  );
}
