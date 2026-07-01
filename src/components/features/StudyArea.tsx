import {
  type BaseSyntheticEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useSearchParams } from "react-router-dom";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import {
  BookOpen,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  SearchIcon,
  Trophy,
  Volume2
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { playAudio } from "@/lib/audio";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import {
  DEFAULT_TOPIC_FILTER,
  QUICK_QUIZ_TOPIC,
  SMART_LEVEL_CUTOFF,
  SMART_PROMOTION_THRESHOLD,
  SRS_REVIEW_TOPIC
} from "@/constants/vocab";
import { OperationType, SRS_INTERVALS, Topic, Vocabulary } from "@/types/types";

type StudyAreaProps = {
  vocabulary: Vocabulary[];
  topics: Topic[];
};

const answerSchema = z.object({
  userAnswer: z.string().trim().min(1, "Vui lòng nhập câu trả lời.")
});

type AnswerFormValues = z.infer<typeof answerSchema>;

type StudyMode = "flashcard" | "quiz" | "smart";
type ActiveMode = "flashcard" | "quiz";

type SmartProgress = {
  goodEasyCount: number;
  promoted: boolean;
};

type FlashcardRating = "again" | "hard" | "good" | "easy";

type FlashcardAssessment = {
  rating: FlashcardRating;
  newLevel: number;
  nextReview: Date | null;
  shouldCommit: boolean;
};

type FlashcardStats = {
  again: number;
  hard: number;
  good: number;
  easy: number;
};

type SummaryViewProps = {
  accuracy: number;
  isPerfect: boolean;
  selectedTopic: string;
  quickQuizTopic: string;
  showFlashcardStats: boolean;
  showQuizStats: boolean;
  flashcardStats: FlashcardStats;
  ratedCount: number;
  totalCount: number;
  score: number;
  quizTotal: number;
  isSavingAssessments: boolean;
  isAssessmentLocked: boolean;
  onBackToTopics: () => void;
  onRestart: () => void;
};

type TopicsViewProps = {
  dueCount: number;
  vocabularyCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filteredTopics: Topic[];
  topicCounts: Map<string, number>;
  showAllTopicsCard: boolean;
  allTopicId: string;
  onStartReviewSRS: () => void;
  onStartQuickQuiz: () => void;
  onSelectTopic: (topicId: string) => void;
};

type StudyViewProps = {
  studyMode: StudyMode;
  onModeChange: (mode: StudyMode) => void;
  topicTitle?: string;
  topicSubtitle: string;
  currentIndex: number;
  totalCount: number;
  activeMode: ActiveMode;
  current: Vocabulary;
  isFlipped: boolean;
  onFlip: () => void;
  flashcardModeLabel: string;
  onPlayAudio: () => void;
  onFlashcardRating: (rating: FlashcardRating) => void;
  onPrev: () => void;
  onNext: () => void;
  isPrevDisabled: boolean;
  isLastCard: boolean;
  onBackToTopics: () => void;
  onSubmitAnswer: (event?: BaseSyntheticEvent) => void;
  answerRegister: UseFormRegisterReturn;
  answerError?: string;
  answerSlots: string[];
  currentWordLength: number;
  filledCount: number;
  feedback: "correct" | "incorrect" | null;
  onSlotChange: (index: number, value: string) => void;
  onSlotKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  onSlotPaste: (index: number, event: ClipboardEvent<HTMLInputElement>) => void;
  slotRefs: MutableRefObject<Array<HTMLInputElement | null>>;
  isAnswerComplete: boolean;
  onRevealAnswer: () => void;
};

function SummaryView({
  accuracy,
  isPerfect,
  selectedTopic,
  quickQuizTopic,
  showFlashcardStats,
  showQuizStats,
  flashcardStats,
  ratedCount,
  totalCount,
  score,
  quizTotal,
  isSavingAssessments,
  isAssessmentLocked,
  onBackToTopics,
  onRestart
}: SummaryViewProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12 text-center space-y-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[40px] p-6 sm:p-10 shadow-xl border border-emerald-50 space-y-8"
      >
        <div className="relative">
          <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100 relative z-10">
            <Trophy className="w-12 h-12 text-white" />
          </div>
          {isPerfect && (
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-emerald-400 rounded-full blur-2xl opacity-20"
            />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight">
            {isPerfect ? "Tuyệt vời! ✨" : accuracy >= 80 ? "Rất tốt! 👏" : accuracy >= 50 ? "Khá lắm! 👍" : "Cố gắng lên! 💪"}
          </h2>
          <p className="text-slate-500 font-medium">
            Bạn đã hoàn thành bài học {selectedTopic === quickQuizTopic ? "thử thách 10 từ vựng" : "chủ đề này"}.
          </p>
        </div>

        {showFlashcardStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="py-5 px-3 bg-rose-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Again</p>
              <div className="text-2xl font-black text-rose-700">{flashcardStats.again}</div>
            </div>
            <div className="py-5 px-3 bg-amber-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Hard</p>
              <div className="text-2xl font-black text-amber-700">{flashcardStats.hard}</div>
            </div>
            <div className="py-5 px-3 bg-emerald-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Good</p>
              <div className="text-2xl font-black text-emerald-700">{flashcardStats.good}</div>
            </div>
            <div className="py-5 px-3 bg-sky-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest">Easy</p>
              <div className="text-2xl font-black text-sky-700">{flashcardStats.easy}</div>
            </div>
          </div>
        )}

        {showQuizStats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="py-6 px-4 bg-emerald-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Độ chính xác</p>
              <div className="text-3xl font-black text-emerald-700">{accuracy}%</div>
            </div>
            <div className="py-6 px-4 bg-slate-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Số câu đúng</p>
              <div className="text-3xl font-black text-slate-700">{score}/{quizTotal}</div>
            </div>
            <div className="py-6 px-4 bg-rose-50 rounded-3xl space-y-1">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Cần cải thiện</p>
              <div className="text-3xl font-black text-rose-700">{quizTotal - score}</div>
            </div>
          </div>
        )}

        {showFlashcardStats && (
          <div className="py-4 px-6 bg-emerald-900 rounded-2xl text-white">
            <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Thống kê Flashcard</p>
            <div className="text-xl font-bold">{ratedCount} / {totalCount} từ vựng đã được đánh giá</div>
            {isSavingAssessments && <p className="text-xs uppercase tracking-widest opacity-60 mt-2">Đang lưu kết quả...</p>}
          </div>
        )}

        <div className="pt-4 space-y-3">
          <Button
            onClick={onBackToTopics}
            disabled={isAssessmentLocked}
            className="w-full h-14 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-lg shadow-lg border-none"
          >
            Quay lại trang chủ học tập
          </Button>
          <Button
            variant="ghost"
            onClick={onRestart}
            disabled={isAssessmentLocked}
            className="w-full h-12 text-emerald-600 font-bold hover:bg-emerald-50"
          >
            Học lại ngay
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function TopicsView({
  dueCount,
  vocabularyCount,
  searchQuery,
  onSearchChange,
  filteredTopics,
  topicCounts,
  showAllTopicsCard,
  allTopicId,
  onStartReviewSRS,
  onStartQuickQuiz,
  onSelectTopic
}: TopicsViewProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8 pb-12">
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Chọn chủ đề ôn tập</h2>
        <p className="text-slate-500 font-medium">Bắt đầu bài học Flashcard của bạn ngay hôm nay</p>
      </div>

      <div className="relative max-w-md mx-auto">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Tìm kiếm chủ đề ôn tập..."
          className="pl-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm h-11 text-base"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div whileHover={{ y: -5 }} className="cursor-pointer group" onClick={onStartReviewSRS}>
          <Card className="h-full border-none shadow-lg shadow-emerald-200/50 hover:shadow-emerald-400/50 transition-all overflow-hidden rounded-[32px] bg-emerald-600 border-b-8 border-emerald-800">
            <CardHeader className="pt-8 pb-4 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white group-hover:scale-110 transition-transform">
                <Brain className="w-8 h-8" />
              </div>
              <CardTitle className="text-xl font-bold text-white">Cần ôn tập</CardTitle>
              <CardDescription className="text-emerald-100/60 font-medium tracking-wide uppercase text-[10px]">
                {dueCount} từ đến hạn
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="cursor-pointer group" onClick={onStartQuickQuiz}>
          <Card className="h-full border-none shadow-lg shadow-amber-200/50 hover:shadow-amber-400/50 transition-all overflow-hidden rounded-[32px] bg-linear-to-br from-amber-500 to-amber-600 border-b-8 border-amber-700">
            <CardHeader className="pt-8 pb-4 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white group-hover:scale-110 transition-transform">
                <Trophy className="w-8 h-8" />
              </div>
              <CardTitle className="text-xl font-bold text-white">Kiểm tra nhanh</CardTitle>
              <CardDescription className="text-amber-100/60 font-medium tracking-wide uppercase text-[10px]">10 từ ngẫu nhiên</CardDescription>
            </CardHeader>
          </Card>
        </motion.div>

        {showAllTopicsCard && (
          <motion.div whileHover={{ y: -5 }} className="cursor-pointer group" onClick={() => onSelectTopic(allTopicId)}>
            <Card className="h-full border-none shadow-lg shadow-slate-200/50 hover:shadow-emerald-200/50 transition-all overflow-hidden rounded-[32px] bg-emerald-900 border-b-8 border-emerald-700">
              <CardHeader className="pt-8 pb-4 text-center">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl font-bold text-white">Tất cả bài học</CardTitle>
                <CardDescription className="text-emerald-300/60">{vocabularyCount} từ vựng</CardDescription>
              </CardHeader>
            </Card>
          </motion.div>
        )}

        {filteredTopics.map((topic) => {
          const topicVocabCount = topicCounts.get(topic.id) ?? 0;
          return (
            <motion.div key={topic.id} whileHover={{ y: -5 }} className="cursor-pointer group" onClick={() => onSelectTopic(topic.id)}>
              <Card className="h-full border-2 border-transparent bg-white shadow-lg shadow-slate-200/50 hover:shadow-emerald-100 transition-all overflow-hidden rounded-[32px] border-b-8 border-b-emerald-50 relative group-hover:border-emerald-500/20">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Brain className="w-24 h-24 text-emerald-900" />
                </div>
                <CardHeader className="pt-8 pb-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 text-emerald-600">
                    <Layers className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-lg font-bold text-slate-800 line-clamp-1">{topic.name}</CardTitle>
                  <CardDescription className="text-slate-400 font-medium">{topicVocabCount} từ vựng</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                        {i}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StudyView({
  studyMode,
  onModeChange,
  topicTitle,
  topicSubtitle,
  currentIndex,
  totalCount,
  activeMode,
  current,
  isFlipped,
  onFlip,
  flashcardModeLabel,
  onPlayAudio,
  onFlashcardRating,
  onPrev,
  onNext,
  isPrevDisabled,
  isLastCard,
  onBackToTopics,
  onSubmitAnswer,
  answerRegister,
  answerError,
  answerSlots,
  currentWordLength,
  filledCount,
  feedback,
  onSlotChange,
  onSlotKeyDown,
  onSlotPaste,
  slotRefs,
  isAnswerComplete,
  onRevealAnswer
}: StudyViewProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-8 pb-12">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToTopics}
            className="self-start text-slate-400 hover:text-emerald-600 h-11 px-3 min-w-11"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Danh sách chủ đề
          </Button>

          <div className="flex w-full flex-wrap items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-white p-1 shadow-sm sm:w-auto">
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg px-4 h-11 ${studyMode === "flashcard" ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white" : "text-slate-500"}`}
              onClick={() => onModeChange("flashcard")}
            >
              Flashcard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg px-4 h-11 ${studyMode === "quiz" ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white" : "text-slate-500"}`}
              onClick={() => onModeChange("quiz")}
            >
              Điền từ
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg px-4 h-11 ${studyMode === "smart" ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white" : "text-slate-500"}`}
              onClick={() => onModeChange("smart")}
            >
              Smart
            </Button>
          </div>
          <div className="hidden sm:block w-25" />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">{topicTitle}</h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{topicSubtitle}</p>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 tracking-widest uppercase bg-emerald-100 px-3 py-1 rounded-full">
            {currentIndex + 1} / {totalCount} {activeMode === "flashcard" ? "THẺ" : "CÂU"}
          </span>
        </div>
        <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 sm:gap-8 min-h-88 sm:min-h-125">
        <Button
          variant="outline"
          size="icon"
          className="hidden sm:flex w-14 h-14 rounded-full bg-white border-none shadow-lg shadow-emerald-100 ring-1 ring-emerald-50 hover:-translate-y-0.5 transition-all disabled:opacity-30 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          disabled={isPrevDisabled}
        >
          <ChevronLeft className="w-6 h-6 text-emerald-600" />
        </Button>

        <div className="flex-1 max-w-2xl">
          {activeMode === "flashcard" ? (
            <div className="relative h-104 sm:h-120 perspective-1000">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  rotateY: isFlipped ? 180 : 0
                }}
                transition={{
                  opacity: { duration: 0.3 },
                  rotateY: { duration: 0.6, type: "spring", stiffness: 260, damping: 25 },
                  y: { duration: 0.4, type: "spring" }
                }}
                className="w-full h-full cursor-pointer relative shadow-xl rounded-[40px]"
                style={{ transformStyle: "preserve-3d" }}
                onClick={onFlip}
              >
                <div className="absolute inset-0 backface-hidden w-full h-full rounded-[40px] bg-white flex flex-col items-center justify-center p-6 sm:p-8 text-center border-b-8 border-emerald-400 overflow-hidden shadow-lg">
                  <motion.div animate={{ opacity: isFlipped ? 0 : 1, y: isFlipped ? 10 : 0 }} className="flex flex-col items-center">
                    <div className="absolute top-8 left-8 opacity-10">
                      <BookOpen className="w-20 h-20 text-emerald-500" />
                    </div>
                    <div className="absolute top-4 left-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">{flashcardModeLabel}</div>

                    <Badge variant="outline" className="mb-6 rounded-lg border-emerald-100 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider px-3 py-1">
                      {current.partOfSpeech || "Vocabulary"}
                    </Badge>
                    <div className="flex items-center gap-4 mb-3">
                      <h2 className="text-5xl font-black text-slate-800 tracking-tight">{current.word}</h2>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-12 h-12 rounded-full text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayAudio();
                        }}
                      >
                        <Volume2 className="w-8 h-8" />
                      </Button>
                    </div>
                    <p className="text-xl font-medium text-slate-400">/ {current.phonetic} /</p>

                    <div className="mt-12 flex items-center gap-3 text-slate-400 animate-pulse">
                      <Brain className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm font-medium uppercase tracking-widest text-[10px]">Nhấn để xem nghĩa tiếng Việt</span>
                    </div>
                  </motion.div>
                </div>

                <div
                  className="absolute inset-0 backface-hidden w-full h-full rounded-[40px] bg-emerald-900 flex flex-col items-center justify-center p-6 sm:p-8 text-center"
                  style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
                >
                  <motion.div
                    animate={{ opacity: isFlipped ? 1 : 0, scale: isFlipped ? 1 : 0.8 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col items-center"
                  >
                    <div className="absolute top-8 right-8 opacity-10">
                      <Brain className="w-20 h-20 text-emerald-400" />
                    </div>
                    <p className="text-emerald-400/60 text-[10px] font-bold uppercase tracking-widest mb-6">Nghĩa Tiếng Việt</p>
                    <h3 className="text-4xl font-bold text-white leading-relaxed tracking-tight">{current.definition}</h3>
                    <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-sm">
                      <Button
                        className="h-11 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFlashcardRating("again");
                        }}
                      >
                        Again
                      </Button>
                      <Button
                        className="h-11 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFlashcardRating("hard");
                        }}
                      >
                        Hard
                      </Button>
                      <Button
                        className="h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFlashcardRating("good");
                        }}
                      >
                        Good
                      </Button>
                      <Button
                        className="h-11 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFlashcardRating("easy");
                        }}
                      >
                        Easy
                      </Button>
                    </div>
                    <p className="absolute bottom-10 text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">Chọn mức độ nhớ để tiếp tục</p>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          ) : (
            <motion.div
              key={`quiz-${currentIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[40px] p-6 sm:p-8 shadow-xl border border-emerald-50 h-104 sm:h-120 flex flex-col items-center justify-between"
            >
              <div className="w-full text-center space-y-6">
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Fill in the blanks</div>
                <div className="space-y-4">
                  <p className="text-emerald-600/60 text-xs font-bold uppercase tracking-widest">Nghĩa Tiếng Việt</p>
                  <h3 className="text-3xl font-black text-slate-800 leading-tight">{current.definition}</h3>
                </div>
              </div>

              <form onSubmit={onSubmitAnswer} className="w-full space-y-6">
                <input type="hidden" {...answerRegister} />
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {Array.from({ length: currentWordLength }).map((_, index) => {
                      const slotValue = answerSlots[index] ?? "";
                      const slotStateClass =
                        feedback === "correct"
                          ? "border-emerald-500 text-emerald-700"
                          : feedback === "incorrect"
                            ? "border-rose-500 text-rose-700"
                            : "border-emerald-200 text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60";

                      return (
                        <input
                          key={`slot-${currentIndex}-${index}`}
                          ref={(el) => {
                            slotRefs.current[index] = el;
                          }}
                          value={slotValue}
                          maxLength={1}
                          autoFocus={index === 0}
                          aria-label={`Ký tự ${index + 1}`}
                          aria-invalid={!!answerError}
                          inputMode="text"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(event) => onSlotChange(index, event.target.value)}
                          onKeyDown={(event) => onSlotKeyDown(index, event)}
                          onPaste={(event) => onSlotPaste(index, event)}
                          className={`h-14 w-12 sm:w-14 text-2xl font-black text-center rounded-2xl border-2 shadow-sm transition-all outline-none ${
                            slotValue ? "bg-white" : "bg-slate-50"
                          } ${slotStateClass}`}
                        />
                      );
                    })}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
                    {filledCount}/{currentWordLength} chữ
                  </div>
                  {answerError && <p className="text-xs text-rose-500 font-medium text-center">{answerError}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={!isAnswerComplete}
                  className={`w-full h-14 rounded-2xl text-lg font-bold shadow-lg transition-all border-none ${
                    feedback === "correct" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {feedback === "correct" ? "Làm tiếp câu khác" : "Kiểm tra kết quả"}
                </Button>

                {feedback === "incorrect" && (
                  <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center text-sm font-medium text-rose-500">
                    Gợi ý: Từ này bắt đầu bằng chữ <span className="font-bold text-rose-700">"{current.word[0].toUpperCase()}"</span>
                  </motion.p>
                )}
              </form>

              <div className="w-full pt-4 border-t border-slate-50 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-emerald-500 min-h-11 px-4"
                  onClick={onRevealAnswer}
                >
                  Xem đáp án
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="hidden sm:flex w-14 h-14 rounded-full bg-white border-none shadow-lg shadow-emerald-100 ring-1 ring-emerald-50 hover:-translate-y-0.5 transition-all disabled:opacity-30 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          {isLastCard ? <Check className="w-6 h-6 text-emerald-600" /> : <ChevronRight className="w-6 h-6 text-emerald-600" />}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-6 pt-4 sm:hidden">
        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full bg-white border-none shadow-lg shadow-emerald-100 ring-1 ring-emerald-50 hover:-translate-y-0.5 transition-all disabled:opacity-30"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          disabled={isPrevDisabled}
        >
          <ChevronLeft className="w-6 h-6 text-emerald-600" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full bg-white border-none shadow-lg shadow-emerald-100 ring-1 ring-emerald-50 hover:-translate-y-0.5 transition-all disabled:opacity-30"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          {isLastCard ? <Check className="w-6 h-6 text-emerald-600" /> : <ChevronRight className="w-6 h-6 text-emerald-600" />}
        </Button>
      </div>
    </div>
  );
}

export function StudyArea({ vocabulary, topics }: StudyAreaProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const topicParam = searchParams.get("topicId");

  const [selectedTopic, setSelectedTopic] = useState<string>(
    topicParam && topics.some((t) => t.id === topicParam) ? topicParam : DEFAULT_TOPIC_FILTER
  );
  const [view, setView] = useState<"topics" | "study" | "summary">(
    topicParam && topics.some((t) => t.id === topicParam) ? "study" : "topics"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("smart");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [quizVocab, setQuizVocab] = useState<Vocabulary[]>([]);
  const [score, setScore] = useState(0);
  const [quizAttempts, setQuizAttempts] = useState(0);
  const [flashcardAssessments, setFlashcardAssessments] = useState<Record<string, FlashcardAssessment>>({});
  const [smartProgress, setSmartProgress] = useState<Record<string, SmartProgress>>({});
  const [isSavingAssessments, setIsSavingAssessments] = useState(false);
  const [hasCommittedAssessments, setHasCommittedAssessments] = useState(false);
  const [answerSlots, setAnswerSlots] = useState<string[]>([]);
  const slotRefs = useRef<Array<HTMLInputElement | null>>([]);
  const {
    register,
    handleSubmit,
    reset: resetAnswer,
    setValue,
    formState: { errors }
  } = useForm<AnswerFormValues>({
    resolver: zodResolver(answerSchema),
    defaultValues: {
      userAnswer: ""
    }
  });
  const answerRegister = register("userAnswer");

  const maxLevel = SRS_INTERVALS.length;

  const resolveReviewDate = (nextReview: Vocabulary["nextReview"]) => {
    if (!nextReview) return null;
    if (typeof nextReview === "object" && "toDate" in nextReview) {
      return nextReview.toDate();
    }
    return new Date(nextReview);
  };

  const clampLevel = (level: number) => Math.max(0, Math.min(maxLevel, level));

  const getNextReviewDate = (level: number) => {
    if (level >= maxLevel) return null;
    const daysToAdd = SRS_INTERVALS[level] ?? SRS_INTERVALS[0];
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + daysToAdd);
    return nextReview;
  };

  const getNextLevelFromRating = (level: number, rating: FlashcardRating) => {
    switch (rating) {
      case "again":
        return 0;
      case "hard":
        return clampLevel(level - 1);
      case "good":
        return clampLevel(level + 1);
      case "easy":
        return clampLevel(level + 2);
      default:
        return clampLevel(level);
    }
  };

  const filtered = useMemo(
    () =>
      quizVocab.length > 0
        ? quizVocab
        : vocabulary.filter((v) => selectedTopic === DEFAULT_TOPIC_FILTER || v.topicId === selectedTopic),
    [quizVocab, selectedTopic, vocabulary]
  );

  const resolveSmartModeForWord = (word: Vocabulary): ActiveMode => {
    const level = word.level ?? 0;
    if (smartProgress[word.id]?.promoted) return "quiz";
    return level >= SMART_LEVEL_CUTOFF ? "quiz" : "flashcard";
  };

  const getActiveModeForIndex = (index: number): ActiveMode => {
    if (studyMode === "smart") {
      const word = filtered[index];
      if (!word) return "flashcard";
      return resolveSmartModeForWord(word);
    }
    return studyMode === "quiz" ? "quiz" : "flashcard";
  };

  const activeMode = getActiveModeForIndex(currentIndex);
  const flashcardModeLabel = studyMode === "smart" ? "Smart Mode" : "Flashcard Mode";

  const currentWordLength = filtered[currentIndex]?.word.length ?? 0;

  const dueCount = useMemo(() => {
    const now = Date.now();
    return vocabulary.filter((v) => {
      const level = v.level ?? 0;
      if (level >= maxLevel) return false;
      const nextDate = resolveReviewDate(v.nextReview);
      return !nextDate || nextDate.getTime() <= now;
    }).length;
  }, [vocabulary]);

  const flashcardStats = useMemo(() => {
    const stats: FlashcardStats = { again: 0, hard: 0, good: 0, easy: 0 };
    Object.values(flashcardAssessments).forEach((assessment) => {
      stats[assessment.rating] += 1;
    });
    return stats;
  }, [flashcardAssessments]);

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    vocabulary.forEach((v) => {
      if (!v.topicId) return;
      counts.set(v.topicId, (counts.get(v.topicId) ?? 0) + 1);
    });
    return counts;
  }, [vocabulary]);

  const filteredTopics = useMemo(
    () => topics.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [searchQuery, topics]
  );

  const showAllTopicsCard = useMemo(
    () => !searchQuery || "tất cả bài học".includes(searchQuery.toLowerCase()),
    [searchQuery]
  );

  const reset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    resetAnswer({ userAnswer: "" });
    setAnswerSlots([]);
    setFeedback(null);
    if (view === "topics") {
      setQuizVocab([]);
      setScore(0);
    }
    if (view !== "summary") {
      setQuizAttempts(0);
      setSmartProgress({});
      setFlashcardAssessments({});
      setIsSavingAssessments(false);
      setHasCommittedAssessments(false);
    }
  };

  useEffect(() => {
    reset();
  }, [selectedTopic, studyMode, view]);

  useEffect(() => {
    if (view !== "study" || activeMode !== "quiz") return;
    setAnswerSlots(Array.from({ length: currentWordLength }, () => ""));
    setValue("userAnswer", "");
  }, [activeMode, currentIndex, currentWordLength, view, setValue]);

  const startQuickQuiz = () => {
    const shuffled = [...vocabulary].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);
    setQuizVocab(selected);
    setSelectedTopic(QUICK_QUIZ_TOPIC);
    setStudyMode("quiz");
    setView("study");
    setScore(0);
    setQuizAttempts(0);
  };

  const startReviewSRS = () => {
    const now = new Date();
    const due = vocabulary.filter((v) => {
      const level = v.level ?? 0;
      if (level >= maxLevel) return false;
      const nextDate = resolveReviewDate(v.nextReview);
      return !nextDate || nextDate <= now;
    });

    if (due.length === 0) {
      toast.info("Bạn đã hoàn thành hết các mục cần ôn tập! ✨");
      return;
    }

    setQuizVocab(due);
    setSelectedTopic(SRS_REVIEW_TOPIC);
    setStudyMode("smart");
    setView("study");
    setScore(0);
    setQuizAttempts(0);
  };

  const selectTopic = (topicId: string) => {
    setSelectedTopic(topicId);
    setQuizVocab([]);
    setView("study");
  };

  const resetQuizSlotsForIndex = (index: number) => {
    const nextMode = getActiveModeForIndex(index);
    if (nextMode !== "quiz") return;
    const nextLength = filtered[index]?.word.length ?? 0;
    setAnswerSlots(Array.from({ length: nextLength }, () => ""));
    setValue("userAnswer", "");
  };

  const next = () => {
    if (currentIndex < filtered.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      resetAnswer({ userAnswer: "" });
      resetQuizSlotsForIndex(nextIndex);
      setFeedback(null);
    } else {
      setView("summary");
    }
  };

  const prev = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
      resetAnswer({ userAnswer: "" });
      resetQuizSlotsForIndex(prevIndex);
      setFeedback(null);
    }
  };

  const checkAnswer = async (data: AnswerFormValues) => {
    const trimmedAnswer = data.userAnswer.trim();
    if (!trimmedAnswer) return;

    const currentVocab = filtered[currentIndex];
    const isCorrect = trimmedAnswer.toLowerCase() === currentVocab.word.trim().toLowerCase();

    if (!feedback) {
      setQuizAttempts((prev) => prev + 1);
      if (isCorrect) setScore((prev) => prev + 1);

      const baseLevel = currentVocab.level ?? 0;
      const newLevel = isCorrect ? clampLevel(baseLevel + 1) : 0;
      const nextReview = getNextReviewDate(newLevel);

      try {
        await updateDoc(doc(db, "vocabularies", currentVocab.id), {
          level: newLevel,
          nextReview: nextReview ?? null,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `vocabularies/${currentVocab.id}`);
        console.error("SRS Update Error:", err);
      }
    }

    setFeedback(isCorrect ? "correct" : "incorrect");

    if (isCorrect) {
      toast.success("Chính xác! ✨");
    } else {
      toast.error("Chưa đúng rồi, hãy thử lại nhé!");
    }
  };

  const normalizeSlots = (slots: string[]) =>
    Array.from({ length: currentWordLength }, (_, index) => (slots[index] ?? "").slice(0, 1));

  const commitSlots = (slots: string[]) => {
    const normalized = normalizeSlots(slots);
    setAnswerSlots(normalized);
    setValue("userAnswer", normalized.join(""), { shouldDirty: true, shouldValidate: true });
  };

  const handleSlotChange = (index: number, value: string) => {
    const nextSlots = normalizeSlots(answerSlots);
    const nextChar = value.slice(-1);
    nextSlots[index] = nextChar;
    commitSlots(nextSlots);
    if (feedback) setFeedback(null);
    if (nextChar && index < currentWordLength - 1) {
      slotRefs.current[index + 1]?.focus();
    }
  };

  const handleSlotKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      if (answerSlots[index]) {
        const nextSlots = normalizeSlots(answerSlots);
        nextSlots[index] = "";
        commitSlots(nextSlots);
      } else if (index > 0) {
        const nextSlots = normalizeSlots(answerSlots);
        nextSlots[index - 1] = "";
        commitSlots(nextSlots);
        slotRefs.current[index - 1]?.focus();
      }
      if (feedback) setFeedback(null);
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      slotRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < currentWordLength - 1) {
      event.preventDefault();
      slotRefs.current[index + 1]?.focus();
    }
  };

  const handleSlotPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text").replace(/[\r\n\t]/g, "");
    if (!text) return;

    const nextSlots = normalizeSlots(answerSlots);
    let cursor = index;
    for (const char of text) {
      if (cursor >= currentWordLength) break;
      nextSlots[cursor] = char.slice(0, 1);
      cursor += 1;
    }

    commitSlots(nextSlots);
    if (feedback) setFeedback(null);
    if (cursor < currentWordLength) {
      slotRefs.current[cursor]?.focus();
    }
  };

  useEffect(() => {
    if (view !== "summary" || (studyMode !== "flashcard" && studyMode !== "smart")) return;
    if (hasCommittedAssessments) return;

    const entries = Object.entries(flashcardAssessments).filter(([, assessment]) => assessment.shouldCommit);
    if (entries.length === 0) {
      setHasCommittedAssessments(true);
      return;
    }

    const commitAssessments = async () => {
      setIsSavingAssessments(true);
      try {
        const batch = writeBatch(db);
        entries.forEach(([id, assessment]) => {
          batch.update(doc(db, "vocabularies", id), {
            level: assessment.newLevel,
            nextReview: assessment.nextReview ?? null,
            updatedAt: serverTimestamp()
          });
        });
        await batch.commit();
        toast.success("Đã lưu kết quả ôn tập.");
        setHasCommittedAssessments(true);
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.UPDATE, "vocabularies");
        } catch {
        }
        toast.error("Lỗi khi lưu kết quả ôn tập.");
      } finally {
        setIsSavingAssessments(false);
      }
    };

    commitAssessments();
  }, [flashcardAssessments, hasCommittedAssessments, studyMode, view]);

  const handleBackToTopics = () => {
    setView("topics");
    setSearchParams({});
  };
  const answerError = errors.userAnswer?.message;

  if (view === "summary") {
    const quizTotal = quizAttempts > 0 ? quizAttempts : studyMode === "quiz" ? filtered.length : 0;
    const accuracy = quizTotal > 0 ? Math.round((score / quizTotal) * 100) : 0;
    const isPerfect = quizTotal > 0 && accuracy === 100;
    const ratedCount = Object.keys(flashcardAssessments).length;
    const hasFlashcardStats = ratedCount > 0;
    const hasQuizStats = quizTotal > 0;
    const showFlashcardStats = (studyMode === "flashcard" || studyMode === "smart") && hasFlashcardStats;
    const showQuizStats = (studyMode === "quiz" || studyMode === "smart") && hasQuizStats;
    const isAssessmentLocked = (studyMode === "flashcard" || studyMode === "smart") && isSavingAssessments;

    const handleRestart = () => {
      reset();
      setView("study");
    };

    return (
      <SummaryView
        accuracy={accuracy}
        isPerfect={isPerfect}
        selectedTopic={selectedTopic}
        quickQuizTopic={QUICK_QUIZ_TOPIC}
        showFlashcardStats={showFlashcardStats}
        showQuizStats={showQuizStats}
        flashcardStats={flashcardStats}
        ratedCount={ratedCount}
        totalCount={filtered.length}
        score={score}
        quizTotal={quizTotal}
        isSavingAssessments={isSavingAssessments}
        isAssessmentLocked={isAssessmentLocked}
        onBackToTopics={handleBackToTopics}
        onRestart={handleRestart}
      />
    );
  }

  if (view === "topics") {
    return (
      <TopicsView
        dueCount={dueCount}
        vocabularyCount={vocabulary.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredTopics={filteredTopics}
        topicCounts={topicCounts}
        showAllTopicsCard={showAllTopicsCard}
        allTopicId={DEFAULT_TOPIC_FILTER}
        onStartReviewSRS={startReviewSRS}
        onStartQuickQuiz={startQuickQuiz}
        onSelectTopic={selectTopic}
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-12 sm:py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-emerald-500">
          <Brain className="w-10 h-10" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xl font-bold text-slate-900">Chủ đề này chưa có từ vựng</p>
            <p className="text-slate-400 text-sm italic">Hãy thêm từ vựng vào chủ đề để bắt đầu học với Flashcard.</p>
          </div>
          <Button
            variant="ghost"
            onClick={handleBackToTopics}
            className="text-emerald-600 hover:text-emerald-700 font-bold min-h-11 px-3"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Quay lại chọn chủ đề
          </Button>
        </div>
      </div>
    );
  }

  const current = filtered[currentIndex];
  const filledCount = answerSlots.filter((slot) => slot !== "").length;
  const isAnswerComplete = currentWordLength > 0 && filledCount === currentWordLength;
  const handleFlashcardRating = (rating: FlashcardRating) => {
    const currentLevel = current.level ?? 0;
    const newLevel = getNextLevelFromRating(currentLevel, rating);
    const nextReview = getNextReviewDate(newLevel);
    const isSmartMode = studyMode === "smart";
    const isPromotionRating = rating === "good" || rating === "easy";
    const isLowLevel = currentLevel < SMART_LEVEL_CUTOFF;
    const progress = smartProgress[current.id] ?? { goodEasyCount: 0, promoted: false };
    const nextGoodEasyCount = isPromotionRating ? progress.goodEasyCount + 1 : 0;
    const shouldPromote =
      isSmartMode &&
      isLowLevel &&
      isPromotionRating &&
      nextGoodEasyCount >= SMART_PROMOTION_THRESHOLD;

    if (isSmartMode && isLowLevel) {
      setSmartProgress((prev) => ({
        ...prev,
        [current.id]: {
          goodEasyCount: nextGoodEasyCount,
          promoted: progress.promoted || shouldPromote
        }
      }));
    }

    setFlashcardAssessments((prev) => ({
      ...prev,
      [current.id]: {
        rating,
        newLevel,
        nextReview,
        shouldCommit: !isSmartMode || !shouldPromote
      }
    }));

    if (isSmartMode && shouldPromote) {
      setIsFlipped(false);
      setFeedback(null);
      setAnswerSlots(Array.from({ length: currentWordLength }, () => ""));
      setValue("userAnswer", "");
      return;
    }

    next();
  };

  const topicTitle =
    selectedTopic === DEFAULT_TOPIC_FILTER
      ? "Tất cả bài học"
      : selectedTopic === QUICK_QUIZ_TOPIC
        ? "Kiểm tra nhanh"
        : selectedTopic === SRS_REVIEW_TOPIC
          ? "Ôn tập đến hạn"
          : topics.find((t) => t.id === selectedTopic)?.name;
  const topicSubtitle =
    selectedTopic === SRS_REVIEW_TOPIC
      ? "Thuật toán SRS Spaced Repetition"
      : selectedTopic === QUICK_QUIZ_TOPIC
        ? "Thử thách 10 từ vựng"
        : "Đang ôn tập";
  const handleFlip = () => setIsFlipped((prevValue) => !prevValue);
  const handlePlayAudio = () => playAudio(current.word);
  const onSubmitAnswer = handleSubmit(checkAnswer);
  const handleRevealAnswer = () => {
    const nextSlots = Array.from({ length: currentWordLength }, (_, index) => current.word[index] ?? "");
    commitSlots(nextSlots);
    setFeedback("correct");
  };

  return (
    <StudyView
      studyMode={studyMode}
      onModeChange={setStudyMode}
      topicTitle={topicTitle}
      topicSubtitle={topicSubtitle}
      currentIndex={currentIndex}
      totalCount={filtered.length}
      activeMode={activeMode}
      current={current}
      isFlipped={isFlipped}
      onFlip={handleFlip}
      flashcardModeLabel={flashcardModeLabel}
      onPlayAudio={handlePlayAudio}
      onFlashcardRating={handleFlashcardRating}
      onPrev={prev}
      onNext={next}
      isPrevDisabled={currentIndex === 0}
      isLastCard={currentIndex === filtered.length - 1}
      onBackToTopics={handleBackToTopics}
      onSubmitAnswer={onSubmitAnswer}
      answerRegister={answerRegister}
      answerError={answerError}
      answerSlots={answerSlots}
      currentWordLength={currentWordLength}
      filledCount={filledCount}
      feedback={feedback}
      onSlotChange={handleSlotChange}
      onSlotKeyDown={handleSlotKeyDown}
      onSlotPaste={handleSlotPaste}
      slotRefs={slotRefs}
      isAnswerComplete={isAnswerComplete}
      onRevealAnswer={handleRevealAnswer}
    />
  );
}
