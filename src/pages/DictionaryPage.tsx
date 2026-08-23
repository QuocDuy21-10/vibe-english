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

  const hasActiveFilter =
    selectedTopicId !== DEFAULT_TOPIC_FILTER ||
    statusFilter !== "all" ||
    searchQuery.trim().length > 0;

  const activeFilterCount =
    (selectedTopicId !== DEFAULT_TOPIC_FILTER ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (searchQuery.trim().length > 0 ? 1 : 0);

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedTopicId(DEFAULT_TOPIC_FILTER);
    setStatusFilter("all");
    setSortOption("newest");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Action Bar & Search */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Tìm kiếm từ vựng, định nghĩa hoặc phiên âm..."
              className="pl-10 pr-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm h-11 text-sm"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 cursor-pointer text-slate-400 hover:text-slate-600 rounded-full"
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
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <>
                {/* Bulk Import Trigger */}
                <Dialog open={isBulkImporting} onOpenChange={setIsBulkImporting}>
                  <DialogTrigger
                    render={
                      <Button
                        variant="outline"
                        className="flex-1 sm:flex-none rounded-full px-3.5 sm:px-4 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-700 transition-all h-11 font-medium cursor-pointer shadow-sm min-h-[44px]"
                      />
                    }
                  >
                    <UploadCloud className="w-4 h-4 mr-1.5 text-emerald-600 shrink-0" />
                    <span className="hidden sm:inline">Nhập hàng loạt</span>
                    <span className="sm:hidden text-xs font-semibold">Nhập</span>
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
                        className="flex-1 sm:flex-none bg-[#006c49] hover:bg-[#006c49]/90 text-white rounded-full px-4 shadow-sm shadow-[#006c49]/20 border-none transition-all h-11 font-medium cursor-pointer min-h-[44px]"
                      />
                    }
                  >
                    <Plus className="w-4 h-4 mr-1.5 shrink-0" />
                    <span className="hidden sm:inline">Thêm từ mới</span>
                    <span className="sm:hidden text-xs font-semibold">Thêm từ</span>
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
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center lg:justify-between gap-2.5">
            {/* Topic Filter */}
            <div className="w-full lg:w-56">
              <TopicFilterSelect
                value={selectedTopicId}
                onValueChange={(value) => {
                  setSelectedTopicId(value);
                  setCurrentPage(1);
                }}
                topics={topics}
                vocabularies={vocabularies}
                className="w-full h-10"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-auto lg:w-48">
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val as VocabularyStatusFilter);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full rounded-full h-10 border-slate-200 bg-white text-xs font-medium px-3.5">
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

            {/* Sort Option */}
            <div className="w-full sm:w-auto lg:w-52 sm:col-span-2 lg:col-span-1">
              <Select
                value={sortOption}
                onValueChange={(val) => {
                  setSortOption(val as VocabularySortOption);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full rounded-full h-10 border-slate-200 bg-white text-xs font-medium px-3.5">
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

          {/* Active Filter Indicators */}
          {hasActiveFilter && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đang lọc:</span>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 font-semibold text-[11px] px-2 py-0.5 rounded-full">
                  {activeFilterCount} tiêu chí
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAllFilters}
                className="h-7 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 rounded-lg cursor-pointer"
              >
                Xóa bộ lọc
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Vocabulary Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
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
        <div className="py-16 sm:py-20 text-center space-y-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm max-w-md mx-auto">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <Search className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <p className="text-slate-800 font-bold text-base">
              {vocabularies.length === 0 ? "Bạn chưa có từ vựng nào." : "Không tìm thấy từ vựng phù hợp."}
            </p>
            <p className="text-slate-400 text-xs leading-relaxed">
              {vocabularies.length === 0
                ? "Thêm từ đầu tiên để bắt đầu hành trình học từ vựng tiếng Anh."
                : "Thử tìm với từ khóa khác hoặc xóa bộ lọc để xem toàn bộ danh sách."}
            </p>
          </div>
          {vocabularies.length === 0 ? (
            <Dialog open={isAddingVocab} onOpenChange={setIsAddingVocab}>
              <DialogTrigger
                render={
                  <Button className="bg-[#006c49] hover:bg-[#006c49]/90 text-white rounded-full px-5 h-11 font-semibold text-sm shadow-md" />
                }
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Thêm từ mới ngay
              </DialogTrigger>
              {user && (
                <AddVocabDialog
                  onClose={() => setIsAddingVocab(false)}
                  userId={user.uid}
                  topics={topics}
                  vocabularies={vocabularies}
                />
              )}
            </Dialog>
          ) : (
            <Button
              variant="outline"
              onClick={resetAllFilters}
              className="rounded-full px-5 h-10 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Xóa bộ lọc tìm kiếm
            </Button>
          )}
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
