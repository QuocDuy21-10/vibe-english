import { useMemo, useState } from "react";
import { Check, ChevronDown, Folder, Layers, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DEFAULT_TOPIC_FILTER, UNASSIGNED_TOPIC_FILTER } from "@/constants/vocab";
import { useSortedTopics, useTopicVocabularyCounts } from "@/hooks/useVocabStats";
import { cn } from "@/lib/utils";
import type { Topic, Vocabulary } from "@/types/types";

export type TopicFilterSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  topics: Topic[];
  vocabularies?: Vocabulary[];
  className?: string;
  placeholder?: string;
  showAllOption?: boolean;
  showUnassignedOption?: boolean;
  allValue?: string;
  allLabel?: string;
  unassignedValue?: string;
  unassignedLabel?: string;
  variant?: "filter" | "form";
  disabled?: boolean;
};

export function TopicFilterSelect({
  value,
  onValueChange,
  topics,
  vocabularies = [],
  className,
  placeholder = "Chọn chủ đề",
  showAllOption = true,
  showUnassignedOption = true,
  allValue = DEFAULT_TOPIC_FILTER,
  allLabel = "Tất cả bài học",
  unassignedValue = UNASSIGNED_TOPIC_FILTER,
  unassignedLabel = "Chưa phân loại",
  variant = "filter",
  disabled = false
}: TopicFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const sortedTopics = useSortedTopics(topics);
  const hasVocabularies = vocabularies.length > 0;
  const topicCounts = useTopicVocabularyCounts(vocabularies);

  const totalCount = vocabularies.length;
  const unassignedCount = useMemo(
    () => vocabularies.filter((v) => !v.topicId).length,
    [vocabularies]
  );

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === value),
    [topics, value]
  );

  const selectedLabel = useMemo(() => {
    if (showAllOption && value === allValue) return allLabel;
    if (showUnassignedOption && (value === unassignedValue || value === UNASSIGNED_TOPIC_FILTER || (unassignedValue === "" && value === ""))) {
      return unassignedLabel;
    }
    if (selectedTopic) return selectedTopic.name;
    return placeholder;
  }, [value, selectedTopic, placeholder, showAllOption, allValue, allLabel, showUnassignedOption, unassignedValue, unassignedLabel]);

  const filteredTopics = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedTopics;
    return sortedTopics.filter((topic) =>
      topic.name.toLowerCase().includes(query)
    );
  }, [sortedTopics, searchQuery]);

  const showSpecialOptions = useMemo(() => {
    if (!showAllOption && !showUnassignedOption) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      (showAllOption && (allLabel.toLowerCase().includes(query) || "all".includes(query) || "tất cả".includes(query))) ||
      (showUnassignedOption && (unassignedLabel.toLowerCase().includes(query) || "unassigned".includes(query) || "chưa phân loại".includes(query)))
    );
  }, [searchQuery, showAllOption, showUnassignedOption, allLabel, unassignedLabel]);

  const handleSelect = (topicId: string) => {
    onValueChange(topicId);
    setOpen(false);
    setSearchQuery("");
  };

  const isFormVariant = variant === "form";

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled) return;
        setOpen(nextOpen);
        if (!nextOpen) setSearchQuery("");
      }}
    >
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex items-center justify-between gap-2 h-11 px-4 text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#10b981]/20 cursor-pointer select-none",
          isFormVariant
            ? "w-full rounded-xl border border-slate-200 bg-white font-normal text-slate-700 hover:border-slate-300"
            : "rounded-full border border-slate-200 bg-white font-medium text-slate-800 hover:border-[#10b981] min-w-48",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        aria-label="Chọn chủ đề"
      >
        <div className="flex items-center gap-2 truncate">
          <Layers className={cn("w-4 h-4 shrink-0", isFormVariant ? "text-slate-400" : "text-[#10b981]")} />
          <span className="truncate">{selectedLabel}</span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200",
            open && (isFormVariant ? "rotate-180 text-slate-600" : "rotate-180 text-[#10b981]")
          )}
        />
      </PopoverTrigger>

      <PopoverContent
        align={isFormVariant ? "start" : "end"}
        sideOffset={6}
        className="w-72 sm:w-80 p-2 rounded-2xl bg-white shadow-xl border border-slate-100 z-50"
      >
        {/* Search Header */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm chủ đề..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full h-9.5 pl-9 pr-8 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#10b981]/30 focus:border-[#10b981] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-full"
              aria-label="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Options List */}
        <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
          {/* Quick presets (All / Unassigned) */}
          {showSpecialOptions && (
            <div className="space-y-1 pb-1 mb-1 border-b border-slate-100">
              {showAllOption && (
                <button
                  type="button"
                  onClick={() => handleSelect(allValue)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors text-left cursor-pointer",
                    value === allValue
                      ? "bg-[#ECFDF5] text-[#10b981] font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Layers
                      className={cn(
                        "w-4 h-4 shrink-0",
                        value === allValue ? "text-[#10b981]" : "text-slate-400"
                      )}
                    />
                    <span className="truncate">{allLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {hasVocabularies && (
                      <Badge variant="secondary" className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 font-normal">
                        {totalCount}
                      </Badge>
                    )}
                    {value === allValue && (
                      <Check className="w-4 h-4 text-[#10b981] ml-1" />
                    )}
                  </div>
                </button>
              )}

              {showUnassignedOption && (
                <button
                  type="button"
                  onClick={() => handleSelect(unassignedValue)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors text-left cursor-pointer",
                    value === unassignedValue || (unassignedValue === "" && value === "") || value === UNASSIGNED_TOPIC_FILTER
                      ? "bg-[#ECFDF5] text-[#10b981] font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Folder
                      className={cn(
                        "w-4 h-4 shrink-0",
                        value === unassignedValue || (unassignedValue === "" && value === "") || value === UNASSIGNED_TOPIC_FILTER
                          ? "text-[#10b981]"
                          : "text-slate-400"
                      )}
                    />
                    <span className="truncate">{unassignedLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {hasVocabularies && (
                      <Badge variant="secondary" className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 font-normal">
                        {unassignedCount}
                      </Badge>
                    )}
                    {(value === unassignedValue || (unassignedValue === "" && value === "") || value === UNASSIGNED_TOPIC_FILTER) && (
                      <Check className="w-4 h-4 text-[#10b981] ml-1" />
                    )}
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Filtered Topics List */}
          {filteredTopics.length > 0 ? (
            filteredTopics.map((topic) => {
              const isSelected = value === topic.id;
              const count = topicCounts.get(topic.id) ?? 0;

              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleSelect(topic.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors text-left cursor-pointer",
                    isSelected
                      ? "bg-[#ECFDF5] text-[#10b981] font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Folder
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isSelected ? "text-[#10b981]" : "text-slate-400"
                      )}
                    />
                    <span className="truncate">{topic.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {hasVocabularies && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[11px] px-2 py-0.5 font-normal",
                          isSelected
                            ? "bg-[#ECFDF5] text-[#10b981]"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {count}
                      </Badge>
                    )}
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#10b981] ml-1" />
                    )}
                  </div>
                </button>
              );
            })
          ) : !showSpecialOptions ? (
            <div className="py-6 text-center text-xs text-slate-400">
              Không tìm thấy chủ đề nào
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
