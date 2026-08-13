import { BookOpen, Brain, Layers, SearchIcon, Trophy } from "lucide-react";
import { motion } from "motion/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEFAULT_TOPIC_FILTER } from "@/constants/vocab";
import type { Topic } from "@/types/types";

type StudyTopicPickerProps = {
  topics: Topic[];
  vocabularyCount: number;
  dueCount: number;
  searchQuery: string;
  topicCounts: Map<string, number>;
  onSearchChange: (value: string) => void;
  onStartSrsReview: () => void;
  onStartQuickQuiz: () => void;
  onSelectTopic: (topicId: string) => void;
};

export function StudyTopicPicker({
  topics,
  vocabularyCount,
  dueCount,
  searchQuery,
  topicCounts,
  onSearchChange,
  onStartSrsReview,
  onStartQuickQuiz,
  onSelectTopic
}: StudyTopicPickerProps) {
  const normalizedSearch = searchQuery.toLowerCase();
  const filteredTopics = topics.filter((topic) => topic.name.toLowerCase().includes(normalizedSearch));
  const showAllTopicsCard = !searchQuery || "tất cả bài học".includes(normalizedSearch);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 w-full">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Chọn chủ đề ôn tập</h2>
        <p className="text-slate-500 font-medium">Bắt đầu bài học Flashcard của bạn ngay hôm nay</p>
      </div>

      <div className="relative max-w-md mx-auto">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Tìm kiếm chủ đề ôn tập..."
          className="pl-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm h-11"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.button type="button" whileHover={{ y: -5 }} className="cursor-pointer group text-left" onClick={onStartSrsReview}>
          <Card className="h-full border-none shadow-lg shadow-emerald-200/50 hover:shadow-emerald-400/50 transition-all overflow-hidden rounded-[32px] bg-emerald-600 border-b-8 border-emerald-800">
            <CardHeader className="p-6 text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white group-hover:scale-110 transition-transform">
                <Brain className="w-7 h-7" />
              </div>
              <CardTitle className="text-xl font-bold text-white">Cần ôn tập</CardTitle>
              <CardDescription className="text-emerald-100/60 font-medium tracking-wide uppercase text-[10px] mt-1">
                {dueCount} từ đến hạn
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.button>

        <motion.button type="button" whileHover={{ y: -5 }} className="cursor-pointer group text-left" onClick={onStartQuickQuiz}>
          <Card className="h-full border-none shadow-lg shadow-amber-200/50 hover:shadow-amber-400/50 transition-all overflow-hidden rounded-[32px] bg-linear-to-br from-amber-500 to-amber-600 border-b-8 border-amber-700">
            <CardHeader className="p-6 text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white group-hover:scale-110 transition-transform">
                <Trophy className="w-7 h-7" />
              </div>
              <CardTitle className="text-xl font-bold text-white">Kiểm tra nhanh</CardTitle>
              <CardDescription className="text-amber-100/60 font-medium tracking-wide uppercase text-[10px] mt-1">10 từ ngẫu nhiên</CardDescription>
            </CardHeader>
          </Card>
        </motion.button>

        {showAllTopicsCard && (
          <motion.button
            type="button"
            whileHover={{ y: -5 }}
            className="cursor-pointer group text-left"
            onClick={() => onSelectTopic(DEFAULT_TOPIC_FILTER)}
          >
            <Card className="h-full border-none shadow-lg shadow-slate-200/50 hover:shadow-emerald-200/50 transition-all overflow-hidden rounded-[32px] bg-emerald-900 border-b-8 border-emerald-700">
              <CardHeader className="p-6 text-center">
                <div className="w-14 h-14 bg-emerald-50/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-400 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-7 h-7" />
                </div>
                <CardTitle className="text-xl font-bold text-white">Tất cả bài học</CardTitle>
                <CardDescription className="text-emerald-300/60 text-xs mt-1">{vocabularyCount} từ vựng</CardDescription>
              </CardHeader>
            </Card>
          </motion.button>
        )}

        {filteredTopics.map((topic) => (
          <motion.button
            key={topic.id}
            type="button"
            whileHover={{ y: -5 }}
            className="cursor-pointer group text-left"
            onClick={() => onSelectTopic(topic.id)}
          >
            <Card className="h-full border-2 border-transparent bg-white shadow-lg shadow-slate-200/50 hover:shadow-emerald-100 transition-all overflow-hidden rounded-[32px] border-b-8 border-b-emerald-50 relative group-hover:border-emerald-500/20">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Brain className="w-24 h-24 text-emerald-900" />
              </div>
              <CardHeader className="p-6 pb-3">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-3 text-emerald-600">
                  <Layers className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-800 line-clamp-1">{topic.name}</CardTitle>
                <CardDescription className="text-slate-400 font-medium text-xs mt-0.5">
                  {topicCounts.get(topic.id) ?? 0} từ vựng
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-5 pt-0">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
