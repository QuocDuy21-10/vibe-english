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
};

export function TopicFilterSelect({
  value,
  onValueChange,
  topics,
  vocabularies = [],
  className,
  placeholder = "Tất cả chủ đề"
}: TopicFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const sortedTopics = useSortedTopics(topics);
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
    if (value === DEFAULT_TOPIC_FILTER) return "Tất cả bài học";
    if (value === UNASSIGNED_TOPIC_FILTER) return "Chưa phân loại";
    if (selectedTopic) return selectedTopic.name;
    return placeholder;
  }, [value, selectedTopic, placeholder]);

  const filteredTopics = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedTopics;
    return sortedTopics.filter((topic) =>
      topic.name.toLowerCase().includes(query)
    );
  }, [sortedTopics, searchQuery]);

  const showSpecialOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      "tất cả bài học".includes(query) ||
      "chưa phân loại".includes(query) ||
      "all".includes(query) ||
      "unassigned".includes(query)
    );
  }, [searchQuery]);

  const handleSelect = (topicId: string) => {
    onValueChange(topicId);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearchQuery("");
      }}
    >
      <PopoverTrigger
        className={cn(
          "flex items-center justify-between gap-2 h-11 px-4 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-800 shadow-sm transition-all hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer min-w-48 select-none",
          className
        )}
        aria-label="Chọn bộ lọc chủ đề"
      >
        <div className="flex items-center gap-2 truncate">
          <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">{selectedLabel}</span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200",
            open && "rotate-180 text-emerald-600"
          )}
        />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-72 sm:w-80 p-2 rounded-2xl bg-white shadow-xl border border-slate-100"
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
            className="w-full h-9.5 pl-9 pr-8 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
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
              <button
                type="button"
                onClick={() => handleSelect(DEFAULT_TOPIC_FILTER)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors text-left cursor-pointer",
                  value === DEFAULT_TOPIC_FILTER
                    ? "bg-emerald-50 text-emerald-900 font-semibold"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Layers
                    className={cn(
                      "w-4 h-4 shrink-0",
                      value === DEFAULT_TOPIC_FILTER
                        ? "text-emerald-600"
                        : "text-slate-400"
                    )}
                  />
                  <span className="truncate">Tất cả bài học</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <Badge variant="secondary" className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 font-normal">
                    {totalCount}
                  </Badge>
                  {value === DEFAULT_TOPIC_FILTER && (
                    <Check className="w-4 h-4 text-emerald-600 ml-1" />
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelect(UNASSIGNED_TOPIC_FILTER)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors text-left cursor-pointer",
                  value === UNASSIGNED_TOPIC_FILTER
                    ? "bg-emerald-50 text-emerald-900 font-semibold"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder
                    className={cn(
                      "w-4 h-4 shrink-0",
                      value === UNASSIGNED_TOPIC_FILTER
                        ? "text-emerald-600"
                        : "text-slate-400"
                    )}
                  />
                  <span className="truncate">Chưa phân loại</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <Badge variant="secondary" className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 font-normal">
                    {unassignedCount}
                  </Badge>
                  {value === UNASSIGNED_TOPIC_FILTER && (
                    <Check className="w-4 h-4 text-emerald-600 ml-1" />
                  )}
                </div>
              </button>
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
                      ? "bg-emerald-50 text-emerald-900 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Folder
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isSelected ? "text-emerald-600" : "text-slate-400"
                      )}
                    />
                    <span className="truncate">{topic.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[11px] px-2 py-0.5 font-normal",
                        isSelected
                          ? "bg-emerald-100/70 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {count}
                    </Badge>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 ml-1" />
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
