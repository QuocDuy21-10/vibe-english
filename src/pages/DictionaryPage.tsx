import { useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpDown,
  Filter,
  Layers,
  Plus,
  Search,
  SearchIcon,
  UploadCloud,
  X
} from "lucide-react";
import { AnimatePresence } from "motion/react";

import { AddVocabDialog } from "@/components/features/AddVocabDialog";
import { BulkImportDialog } from "@/components/features/BulkImportDialog";
import { TopicFilterSelect } from "@/components/features/TopicFilterSelect";
import { VocabCard } from "@/components/features/VocabCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { DEFAULT_TOPIC_FILTER } from "@/constants/vocab";
import { useFilteredAndSortedVocabularies } from "@/hooks/useVocabStats";
import { getPaginationModel } from "@/lib/pagination";
import type { VocabularySortOption, VocabularyStatusFilter } from "@/lib/vocabularySelectors";
import { useAppData } from "@/routes/AppDataProvider";

export function DictionaryPage() {
  const { vocabularies, topics, user } = useAppData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(DEFAULT_TOPIC_FILTER);
  const [statusFilter, setStatusFilter] = useState<VocabularyStatusFilter>("all");
  const [sortOption, setSortOption] = useState<VocabularySortOption>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isAddingVocab, setIsAddingVocab] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);

  const filteredVocab = useFilteredAndSortedVocabularies(vocabularies, {
    searchQuery,
    selectedTopicId,
    statusFilter,
    sortOption
  });

  const pagination = getPaginationModel(filteredVocab.length, pageSize, currentPage);
  const paginatedVocab = filteredVocab.slice(pagination.startIndex, pagination.endIndex);

  return (
    <div className="space-y-6">
      {/* Top Action Bar & Search */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Tìm kiếm từ vựng, định nghĩa hoặc phiên âm..."
              className="pl-10 pr-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm h-11"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button
                className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                aria-label="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {user && (
              <>
                {/* Bulk Import Trigger */}
                <Dialog open={isBulkImporting} onOpenChange={setIsBulkImporting}>
                  <DialogTrigger
                    render={
                      <Button
                        variant="outline"
                        size="default"
                        className="rounded-full px-4 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-700 transition-all h-11 shrink-0 font-medium cursor-pointer shadow-sm"
                      />
                    }
                  >
                    <UploadCloud className="w-4 h-4 mr-1.5 text-emerald-600" />
                    <span className="hidden sm:inline">Nhập hàng loạt</span>
                    <span className="sm:hidden">Nhập</span>
                  </DialogTrigger>
                  <BulkImportDialog
                    onClose={() => setIsBulkImporting(false)}
                    userId={user.uid}
                    topics={topics}
                    vocabularies={vocabularies}
                  />
                </Dialog>

                {/* Single Add Vocab Trigger */}
                <Dialog open={isAddingVocab} onOpenChange={setIsAddingVocab}>
                  <DialogTrigger
                    render={
                      <Button
                        size="default"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-4 shadow-sm shadow-emerald-600/20 border-none transition-all h-11 shrink-0 font-medium cursor-pointer"
                      />
                    }
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">Thêm từ mới</span>
                    <span className="sm:hidden">Thêm</span>
                  </DialogTrigger>
                  <AddVocabDialog
                    onClose={() => setIsAddingVocab(false)}
                    userId={user.uid}
                    topics={topics}
                    vocabularies={vocabularies}
                  />
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Filter & Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Topic Filter */}
            <TopicFilterSelect
              value={selectedTopicId}
              onValueChange={(value) => {
                setSelectedTopicId(value);
                setCurrentPage(1);
              }}
              topics={topics}
              vocabularies={vocabularies}
              className="w-48 sm:w-56"
            />

            {/* Status Filter */}
            <div className="w-40 sm:w-44">
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val as VocabularyStatusFilter);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="rounded-xl h-10 border-slate-200 bg-white text-xs font-medium">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="due">Cần ôn tập ngay</SelectItem>
                  <SelectItem value="new">Từ mới (Level 0)</SelectItem>
                  <SelectItem value="learning">Đang học (Level 1-3)</SelectItem>
                  <SelectItem value="mastered">Đã thuộc (Level 4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sort Option */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Sắp xếp:</span>
            <div className="w-44 sm:w-48">
              <Select
                value={sortOption}
                onValueChange={(val) => {
                  setSortOption(val as VocabularySortOption);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="rounded-xl h-10 border-slate-200 bg-white text-xs font-medium">
                  <SelectValue placeholder="Sắp xếp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Mới nhất trước</SelectItem>
                  <SelectItem value="oldest">Cũ nhất trước</SelectItem>
                  <SelectItem value="alpha-asc">Từ A → Z</SelectItem>
                  <SelectItem value="alpha-desc">Từ Z → A</SelectItem>
                  <SelectItem value="next-review">Next review gần nhất</SelectItem>
                  <SelectItem value="level-desc">Level cao → thấp</SelectItem>
                  <SelectItem value="level-asc">Level thấp → cao</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Vocabulary Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
        <AnimatePresence mode="popLayout">
          {paginatedVocab.map((vocabulary) => (
            <VocabCard
              key={vocabulary.id}
              vocabulary={vocabulary}
              topics={topics}
              vocabularies={vocabularies}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State or Pagination Controls */}
      {filteredVocab.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto opacity-60">
            <Search className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <p className="text-emerald-900 font-semibold">Không tìm thấy từ vựng nào.</p>
            <p className="text-slate-400 text-xs mt-1">
              Thử tìm với từ khóa khác hoặc điều chỉnh bộ lọc chủ đề/trạng thái.
            </p>
          </div>
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
