import { useState } from "react";
import { Edit3, Plus, SearchIcon, Trash2, X, Search } from "lucide-react";
import { toast } from "sonner";
import { TopicDialog } from "@/components/features/TopicDialog";
import { TopicFilterSelect } from "@/components/features/TopicFilterSelect";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_TOPIC_FILTER } from "@/constants/vocab";
import { useTopicVocabularyCounts } from "@/hooks/useVocabStats";
import { getPaginationModel } from "@/lib/pagination";
import { useAppData } from "@/routes/AppDataProvider";
import { deleteTopic } from "@/services/topicRepository";

export function TopicsPage() {
  const { topics, user, vocabularies } = useAppData();
  const [topicSearchQuery, setTopicSearchQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(DEFAULT_TOPIC_FILTER);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [isAddingTopic, setIsAddingTopic] = useState(false);

  const topicVocabCounts = useTopicVocabularyCounts(vocabularies);

  if (!user) {
    return null;
  }

  const filteredTopics = topics.filter((topic) => {
    const matchesSearch = topic.name.toLowerCase().includes(topicSearchQuery.toLowerCase());
    const matchesTopic = selectedTopicId === DEFAULT_TOPIC_FILTER || topic.id === selectedTopicId;
    return matchesSearch && matchesTopic;
  });

  const pagination = getPaginationModel(filteredTopics.length, pageSize, currentPage);
  const paginatedTopics = filteredTopics.slice(pagination.startIndex, pagination.endIndex);

  const resetFilters = () => {
    setTopicSearchQuery("");
    setSelectedTopicId(DEFAULT_TOPIC_FILTER);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Tìm kiếm chủ đề..."
            className="pl-10 pr-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-[#006c49] transition-all shadow-sm h-11 text-sm"
            value={topicSearchQuery}
            onChange={(event) => {
              setTopicSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
          />
          {topicSearchQuery && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 cursor-pointer text-slate-400 hover:text-slate-600 rounded-full"
              onClick={() => {
                setTopicSearchQuery("");
                setCurrentPage(1);
              }}
              aria-label="Xóa tìm kiếm"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <TopicFilterSelect
            value={selectedTopicId}
            onValueChange={(value) => {
              setSelectedTopicId(value);
              setCurrentPage(1);
            }}
            topics={topics}
            vocabularies={vocabularies}
            showUnassignedOption={false}
            className="flex-1 sm:w-56 h-11"
          />

          <Dialog open={isAddingTopic} onOpenChange={setIsAddingTopic}>
            <DialogTrigger
              render={
                <Button
                  className="bg-[#006c49] hover:bg-[#006c49]/90 text-white rounded-full px-4 shadow-sm shadow-[#006c49]/20 border-none transition-all h-11 shrink-0 font-medium cursor-pointer min-h-[44px]"
                />
              }
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Thêm chủ đề</span>
              <span className="sm:hidden text-xs font-semibold">Thêm</span>
            </DialogTrigger>
            <TopicDialog onClose={() => setIsAddingTopic(false)} userId={user.uid} />
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedTopics.map((topic) => (
          <Card
            key={topic.id}
            className="rounded-2xl sm:rounded-3xl border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-[#10b981]/40 transition-all group overflow-hidden relative flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#ECFDF5] rounded-full -mr-8 -mt-8 opacity-60 group-hover:bg-[#ECFDF5]/90 transition-colors pointer-events-none" />
            <CardHeader className="pb-2 relative">
              <CardTitle className="text-xl font-bold text-slate-800 tracking-tight break-words line-clamp-2">
                {topic.name}
              </CardTitle>
              <CardDescription className="text-xs font-bold text-[#006c49] uppercase tracking-wider mt-1">
                {topicVocabCounts.get(topic.id) ?? 0} TỪ VỰNG
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-end gap-1.5 pt-2 pb-3 px-4 relative border-t-0 bg-transparent">
              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-[#006c49] hover:bg-[#ECFDF5] w-9 h-9 min-w-[36px] rounded-full cursor-pointer border-none"
                      aria-label={`Chỉnh sửa chủ đề ${topic.name}`}
                    />
                  }
                >
                  <Edit3 className="w-4 h-4" />
                </DialogTrigger>
                <TopicDialog topic={topic} userId={user.uid} />
              </Dialog>

              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-destructive hover:bg-rose-50 w-9 h-9 min-w-[36px] rounded-full cursor-pointer border-none"
                aria-label={`Xóa chủ đề ${topic.name}`}
                onClick={async () => {
                  if (
                    confirm(
                      "Xóa chủ đề này sẽ không xóa từ vựng, chúng sẽ được chuyển sang 'Chưa phân loại'. Bạn có chắc chắn?"
                    )
                  ) {
                    try {
                      await deleteTopic(topic.id);
                      toast.success("Đã xóa chủ đề.");
                    } catch {
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
      </div>

      {topics.length === 0 && (
        <div className="py-16 sm:py-20 text-center space-y-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm max-w-md mx-auto">
          <div className="w-16 h-16 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto text-[#006c49]">
            <Plus className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <p className="text-slate-800 font-bold text-base">Chưa có chủ đề nào.</p>
            <p className="text-slate-400 text-xs">Hãy tạo chủ đề đầu tiên để phân loại và học từ vựng hiệu quả hơn.</p>
          </div>
          <Dialog open={isAddingTopic} onOpenChange={setIsAddingTopic}>
            <DialogTrigger
              render={
                <Button className="bg-[#006c49] hover:bg-[#006c49]/90 text-white rounded-full px-5 h-11 font-semibold text-sm shadow-md" />
              }
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Tạo chủ đề mới
            </DialogTrigger>
            <TopicDialog onClose={() => setIsAddingTopic(false)} userId={user.uid} />
          </Dialog>
        </div>
      )}

      {filteredTopics.length === 0 && topics.length > 0 && (
        <div className="py-16 sm:py-20 text-center space-y-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm max-w-md mx-auto">
          <div className="w-16 h-16 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto text-[#006c49]">
            <Search className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <p className="text-slate-800 font-bold text-base">Không tìm thấy chủ đề phù hợp.</p>
            <p className="text-slate-400 text-xs">Thử tìm kiếm với tên chủ đề khác hoặc xóa bộ lọc.</p>
          </div>
          <Button
            variant="outline"
            onClick={resetFilters}
            className="rounded-full px-5 h-10 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-[#ECFDF5] hover:text-[#006c49] hover:border-emerald-300"
          >
            Xóa tìm kiếm
          </Button>
        </div>
      )}

      {topics.length > 0 && filteredTopics.length > 0 && (
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
      )}
    </div>
  );
}
