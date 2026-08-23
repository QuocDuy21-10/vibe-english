import { useState } from "react";
import { Plus, Search, SearchIcon, X } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { AddVocabDialog } from "@/components/features/AddVocabDialog";
import { TopicFilterSelect } from "@/components/features/TopicFilterSelect";
import { VocabCard } from "@/components/features/VocabCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DEFAULT_TOPIC_FILTER } from "@/constants/vocab";
import { useFilteredVocabularies } from "@/hooks/useVocabStats";
import { getPaginationModel } from "@/lib/pagination";
import { useAppData } from "@/routes/AppDataProvider";

export function DictionaryPage() {
  const { vocabularies, topics, user } = useAppData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(DEFAULT_TOPIC_FILTER);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isAddingVocab, setIsAddingVocab] = useState(false);

  const filteredVocab = useFilteredVocabularies(vocabularies, searchQuery, selectedTopicId);

  const pagination = getPaginationModel(filteredVocab.length, pageSize, currentPage);
  const paginatedVocab = filteredVocab.slice(pagination.startIndex, pagination.endIndex);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Tìm kiếm từ vựng hoặc nghĩa..."
            className="pl-10 pr-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm h-11"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
              }}
              aria-label="Xóa tìm kiếm"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <TopicFilterSelect
            value={selectedTopicId}
            onValueChange={(value) => {
              setSelectedTopicId(value);
              setCurrentPage(1);
            }}
            topics={topics}
            vocabularies={vocabularies}
            className="flex-1 md:w-60"
          />

          {user && (
            <Dialog open={isAddingVocab} onOpenChange={setIsAddingVocab}>
              <DialogTrigger
                render={
                  <Button
                    size="default"
                    className="bg-[#10b981] hover:bg-[#10b981]/90 text-white rounded-full px-4 shadow-sm shadow-[#10b981]/10 border-none transition-all h-11 shrink-0 font-medium cursor-pointer"
                  />
                }
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Thêm từ mới</span>
                <span className="sm:hidden">Thêm</span>
              </DialogTrigger>
              <AddVocabDialog onClose={() => setIsAddingVocab(false)} userId={user.uid} topics={topics} />
            </Dialog>
          )}
        </div>
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
        <PaginationControls
          {...pagination}
          totalItems={filteredVocab.length}
          pageSize={pageSize}
          pageSizeOptions={[20, 50, 70, 100]}
          itemLabel="từ vựng"
          pageSizeLabel="Số từ mỗi trang:"
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
