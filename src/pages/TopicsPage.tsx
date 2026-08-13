import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Edit3, SearchIcon, Trash2, X, Search } from "lucide-react";
import { toast } from "sonner";
import { TopicDialog } from "@/components/features/TopicDialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useTopicVocabularyCounts } from "@/hooks/useVocabStats";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { db } from "@/lib/firebase";
import { getPaginationModel } from "@/lib/pagination";
import { useAppData } from "@/routes/AppDataProvider";
import { OperationType } from "@/types/types";

export function TopicsPage() {
  const { topics, user, vocabularies } = useAppData();
  const [topicSearchQuery, setTopicSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const topicVocabCounts = useTopicVocabularyCounts(vocabularies);

  if (!user) {
    return null;
  }

  const filteredTopics = topics.filter((topic) =>
    topic.name.toLowerCase().includes(topicSearchQuery.toLowerCase())
  );

  const pagination = getPaginationModel(filteredTopics.length, pageSize, currentPage);
  const paginatedTopics = filteredTopics.slice(pagination.startIndex, pagination.endIndex);

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Tìm kiếm chủ đề..."
          className="pl-10 pr-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm h-11"
          value={topicSearchQuery}
          onChange={(event) => {
            setTopicSearchQuery(event.target.value);
            setCurrentPage(1);
          }}
        />
        {topicSearchQuery && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
            onClick={() => {
              setTopicSearchQuery("");
              setCurrentPage(1);
            }}
            aria-label="Xóa tìm kiếm"
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
          <PaginationControls
            {...pagination}
            totalItems={filteredTopics.length}
            pageSize={pageSize}
            pageSizeOptions={[6, 12, 18, 24, 30]}
            itemLabel="chủ đề"
            pageSizeLabel="Số chủ đề mỗi trang:"
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setCurrentPage(1);
            }}
          />
        )
      )}
    </div>
  );
}
