import { useState } from "react";
import { Search, SearchIcon, X } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { VocabCard } from "@/components/features/VocabCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_TOPIC_FILTER, UNASSIGNED_TOPIC_FILTER } from "@/constants/vocab";
import { useVocabStats } from "@/hooks/useVocabStats";
import { useAppData } from "@/routes/AppDataProvider";

export function DictionaryPage() {
  const { vocabularies, topics } = useAppData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(DEFAULT_TOPIC_FILTER);

  const { filteredVocab, sortedTopics } = useVocabStats({
    vocabularies,
    topics,
    searchQuery,
    selectedTopicId,
  });

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
        <AnimatePresence mode="popLayout">
          {filteredVocab.map((vocabulary) => (
            <VocabCard key={vocabulary.id} vocabulary={vocabulary} topics={topics} />
          ))}
        </AnimatePresence>
      </div>

      {filteredVocab.length === 0 && (
        <div className="py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto opacity-50">
            <Search className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-emerald-800/60 italic font-medium">Không tìm thấy từ vựng nào.</p>
        </div>
      )}
    </div>
  );
}
