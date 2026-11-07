import { useMemo, useState } from "react";
import { BookOpen, Brain, Layers, RotateCcw, Search, SearchIcon, Trophy, X } from "lucide-react";
import { motion } from "motion/react";

import { TopicFilterSelect } from "@/components/features/TopicFilterSelect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEFAULT_TOPIC_FILTER, UNASSIGNED_TOPIC_FILTER } from "@/constants/vocab";
import { cn } from "@/lib/utils";
import type { Topic, Vocabulary } from "@/types/types";


type StudyTopicPickerProps = {
  topics: Topic[];
  vocabularies?: Vocabulary[];
  vocabularyCount: number;
  dueCount: number;
  searchQuery: string;
  topicCounts: Map<string, number>;
  onSearchChange: (value: string) => void;
  onStartSrsReview: () => void;
  onStartQuickQuiz: () => void;
  weakCount: number;
  onStartWeakPractice: () => void;
  onSelectTopic: (topicId: string) => void;
};

export function StudyTopicPicker({
  topics,
  vocabularies = [],
  vocabularyCount,
  dueCount,
  searchQuery,
  topicCounts,
  onSearchChange,
  onStartSrsReview,
  onStartQuickQuiz,
  weakCount,
  onStartWeakPractice,
  onSelectTopic
}: StudyTopicPickerProps) {
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>(DEFAULT_TOPIC_FILTER);

  const normalizedSearch = searchQuery.toLowerCase();
  const filteredTopics = topics.filter((topic) => {
    const matchesSearch = topic.name.toLowerCase().includes(normalizedSearch);
    const matchesTopic = selectedTopicFilter === DEFAULT_TOPIC_FILTER || topic.id === selectedTopicFilter;
    return matchesSearch && matchesTopic;
  });

  const unassignedCount = useMemo(
    () => vocabularies.filter((v) => !v.topicId).length,
    [vocabularies]
  );

  const showSpecialCards = selectedTopicFilter === DEFAULT_TOPIC_FILTER && !searchQuery;
  const showAllTopicsCard = selectedTopicFilter === DEFAULT_TOPIC_FILTER && (!searchQuery || "tất cả bài học".includes(normalizedSearch));

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-8 sm:pb-12 w-full">
      <div className="text-center space-y-1.5 sm:space-y-2">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Chọn chủ đề ôn tập</h2>
        <p className="text-slate-500 text-sm sm:text-base font-medium">Bắt đầu bài học Flashcard của bạn ngay hôm nay</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 max-w-xl mx-auto items-stretch sm:items-center">
        <div className="relative flex-1 w-full">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Tìm kiếm chủ đề ôn tập..."
            className="pl-10 pr-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-[#10b981] transition-all shadow-sm h-11 text-sm"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 cursor-pointer text-slate-400 hover:text-slate-600 rounded-full"
              onClick={() => onSearchChange("")}
              aria-label="Xóa tìm kiếm"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <TopicFilterSelect
          value={selectedTopicFilter}
          onValueChange={setSelectedTopicFilter}
          topics={topics}
          vocabularies={vocabularies}
          className="w-full sm:w-60 h-11"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {showSpecialCards && (
          <>
            <motion.button
              type="button"
              whileHover={{ y: -4 }}
              className="cursor-pointer group text-left w-full touch-manipulation"
              onClick={onStartSrsReview}
            >
              <Card
                className={cn(
                  "h-full border-none shadow-lg transition-all overflow-hidden rounded-2xl sm:rounded-3xl border-b-8",
                  dueCount > 0
                    ? "bg-[#10b981] border-[#059669] shadow-emerald-950/10 hover:shadow-emerald-950/20"
                    : "bg-slate-800 border-slate-950 shadow-slate-200/50 hover:shadow-emerald-900/30"
                )}
              >
                <CardHeader className="p-5 sm:p-6 text-center">
                  <div
                    className={cn(
                      "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white group-hover:scale-105 transition-transform",
                      dueCount > 0 ? "bg-white/20" : "bg-emerald-500/20 text-emerald-400"
                    )}
                  >
                    <Brain className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-bold text-white">
                    {dueCount > 0 ? "Cần ôn tập" : "Đã hoàn thành ✨"}
                  </CardTitle>
                  <CardDescription
                    className={cn(
                      "font-medium tracking-wide text-xs mt-1",
                      dueCount > 0 ? "text-emerald-100 uppercase font-bold" : "text-emerald-300/80"
                    )}
                  >
                    {dueCount > 0
                      ? `${dueCount} từ đến hạn`
                      : "Bạn đã hoàn thành toàn bộ từ cần ôn hôm nay."}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ y: -4 }}
              className="cursor-pointer group text-left w-full touch-manipulation"
              onClick={onStartQuickQuiz}
            >
              <Card className="h-full border-none shadow-lg shadow-amber-200/50 hover:shadow-amber-300/50 transition-all overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 border-b-8 border-amber-700">
                <CardHeader className="p-5 sm:p-6 text-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white group-hover:scale-105 transition-transform">
                    <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-bold text-white">Kiểm tra nhanh</CardTitle>
                  <CardDescription className="text-amber-100 font-bold tracking-wider uppercase text-xs mt-1">10 từ ngẫu nhiên</CardDescription>
                </CardHeader>
              </Card>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ y: -4 }}
              className="cursor-pointer group text-left w-full touch-manipulation"
              onClick={onStartWeakPractice}
            >
              <Card className="h-full border-none shadow-lg shadow-slate-200/50 hover:shadow-emerald-950/10 transition-all overflow-hidden rounded-2xl sm:rounded-3xl bg-white border-b-8 border-slate-200">
                <CardHeader className="p-5 sm:p-6 text-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-600 group-hover:scale-105 transition-transform">
                    <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-bold text-slate-800">Luyện từ yếu</CardTitle>
                  <CardDescription className="text-slate-500 font-bold tracking-wider uppercase text-xs mt-1">
                    {weakCount > 0 ? `${weakCount} từ hay quên` : "Chưa có từ hay quên"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.button>
          </>
        )}

        {showAllTopicsCard && (
          <motion.button
            type="button"
            whileHover={{ y: -4 }}
            className="cursor-pointer group text-left w-full touch-manipulation"
            onClick={() => onSelectTopic(DEFAULT_TOPIC_FILTER)}
          >
            <Card className="h-full border-none shadow-lg shadow-slate-200/50 hover:shadow-emerald-950/20 transition-all overflow-hidden rounded-2xl sm:rounded-3xl bg-[#10b981] border-b-8 border-[#059669]">
              <CardHeader className="p-5 sm:p-6 text-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white group-hover:scale-105 transition-transform">
                  <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <CardTitle className="text-lg sm:text-xl font-bold text-white">Tất cả bài học</CardTitle>
                <CardDescription className="text-emerald-100 text-xs mt-1 font-medium">{vocabularyCount} từ vựng</CardDescription>
              </CardHeader>
            </Card>
          </motion.button>
        )}

        {selectedTopicFilter === UNASSIGNED_TOPIC_FILTER && (
          <motion.button
            type="button"
            whileHover={{ y: -4 }}
            className="cursor-pointer group text-left w-full touch-manipulation"
            onClick={() => onSelectTopic(UNASSIGNED_TOPIC_FILTER)}
          >
            <Card className="h-full border border-slate-100 bg-white shadow-md shadow-slate-200/50 hover:shadow-emerald-950/5 transition-all overflow-hidden rounded-2xl sm:rounded-3xl border-b-8 border-b-[#ECFDF5] relative group-hover:border-[#10b981]/30">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Brain className="w-24 h-24 text-[#10b981]" />
              </div>
              <CardHeader className="p-5 sm:p-6">
                <div className="w-12 h-12 bg-[#ECFDF5] rounded-xl flex items-center justify-center mb-3 text-[#10b981]">
                  <Layers className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-800 line-clamp-1">Chưa phân loại</CardTitle>
                <CardDescription className="text-slate-400 font-medium text-xs mt-0.5">
                  {unassignedCount} từ vựng
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.button>
        )}

        {filteredTopics.map((topic) => (
          <motion.button
            key={topic.id}
            type="button"
            whileHover={{ y: -4 }}
            className="cursor-pointer group text-left w-full touch-manipulation"
            onClick={() => onSelectTopic(topic.id)}
          >
            <Card className="h-full border border-slate-100 bg-white shadow-md shadow-slate-200/50 hover:shadow-emerald-950/5 transition-all overflow-hidden rounded-2xl sm:rounded-3xl border-b-8 border-b-[#ECFDF5] relative group-hover:border-[#10b981]/30">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Brain className="w-24 h-24 text-[#10b981]" />
              </div>
              <CardHeader className="p-5 sm:p-6">
                <div className="w-12 h-12 bg-[#ECFDF5] rounded-xl flex items-center justify-center mb-3 text-[#10b981]">
                  <Layers className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-800 line-clamp-2 break-words">{topic.name}</CardTitle>
                <CardDescription className="text-slate-400 font-medium text-xs mt-1">
                  {topicCounts.get(topic.id) ?? 0} từ vựng
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.button>
        ))}
      </div>

      {filteredTopics.length === 0 && selectedTopicFilter !== UNASSIGNED_TOPIC_FILTER && (
        <div className="py-12 text-center space-y-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm max-w-md mx-auto">
          <div className="w-16 h-16 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto text-[#10b981]">
            <Search className="w-8 h-8" />
          </div>
          <p className="text-slate-600 text-sm font-medium">Không tìm thấy chủ đề ôn tập nào phù hợp.</p>
        </div>
      )}
    </div>
  );
}
