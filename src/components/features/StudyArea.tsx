import { useEffect, useMemo, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  SearchIcon,
  Sparkles,
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
import { cn } from "@/lib/utils";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { DEFAULT_TOPIC_FILTER, QUICK_QUIZ_TOPIC, SRS_REVIEW_TOPIC } from "@/constants/vocab";
import { OperationType, SRS_INTERVALS, Topic, Vocabulary } from "@/types/types";

type StudyAreaProps = {
  vocabulary: Vocabulary[];
  topics: Topic[];
};

const answerSchema = z.object({
  userAnswer: z.string().trim().min(1, "Vui lòng nhập câu trả lời.")
});

type AnswerFormValues = z.infer<typeof answerSchema>;

type FlashcardRating = "again" | "hard" | "good" | "easy";

type FlashcardAssessment = {
  rating: FlashcardRating;
  newLevel: number;
  nextReview: Date | null;
};

export function StudyArea({ vocabulary, topics }: StudyAreaProps) {
  const [selectedTopic, setSelectedTopic] = useState<string>(DEFAULT_TOPIC_FILTER);
  const [view, setView] = useState<"topics" | "study" | "summary">("topics");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState<"flashcard" | "quiz">("flashcard");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [quizVocab, setQuizVocab] = useState<Vocabulary[]>([]);
  const [score, setScore] = useState(0);
  const [flashcardAssessments, setFlashcardAssessments] = useState<Record<string, FlashcardAssessment>>({});
  const [attemptedWords, setAttemptedWords] = useState<Set<string>>(new Set());
  const [isRating, setIsRating] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset: resetAnswer,
    setValue,
    watch,
    formState: { errors }
  } = useForm<AnswerFormValues>({
    resolver: zodResolver(answerSchema),
    defaultValues: {
      userAnswer: ""
    }
  });

  const { ref: userAnswerRef, ...userAnswerRest } = register("userAnswer", {
    onChange: () => {
      if (feedback) setFeedback(null);
    }
  });

  const userAnswer = watch("userAnswer") ?? "";
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
    const stats = { again: 0, hard: 0, good: 0, easy: 0 };
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
    setFeedback(null);
    if (view === "topics") {
      setQuizVocab([]);
      setScore(0);
    }
    if (view !== "summary") {
      setFlashcardAssessments({});
      setAttemptedWords(new Set());
    }
  };

  useEffect(() => {
    reset();
  }, [selectedTopic, studyMode, view]);

  const startQuickQuiz = () => {
    const shuffled = [...vocabulary].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);
    setQuizVocab(selected);
    setSelectedTopic(QUICK_QUIZ_TOPIC);
    setStudyMode("quiz");
    setView("study");
    setScore(0);
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
    setStudyMode("quiz");
    setView("study");
    setScore(0);
  };

  const selectTopic = (topicId: string) => {
    setSelectedTopic(topicId);
    setQuizVocab([]);
    setView("study");
  };

  const next = () => {
    if (currentIndex < filtered.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      resetAnswer({ userAnswer: "" });
      setFeedback(null);
    } else {
      setView("summary");
    }
  };

  const prev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
      resetAnswer({ userAnswer: "" });
      setFeedback(null);
    }
  };

  const checkAnswer = async (data: AnswerFormValues) => {
    const trimmedAnswer = data.userAnswer.trim();
    if (!trimmedAnswer) return;

    const currentVocab = filtered[currentIndex];
    const isCorrect = trimmedAnswer.toLowerCase() === currentVocab.word.trim().toLowerCase();

    if (!feedback) {
      const isFirstAttempt = !attemptedWords.has(currentVocab.id);
      
      if (isFirstAttempt) {
        setAttemptedWords((prev) => new Set(prev).add(currentVocab.id));
        
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
    }

    setFeedback(isCorrect ? "correct" : "incorrect");

    if (isCorrect) {
      toast.success("Chính xác! ✨");
    } else {
      toast.error("Chưa đúng rồi, hãy thử lại nhé!");
    }
  };


  if (view === "summary") {
    const accuracy = filtered.length > 0 ? Math.round((score / filtered.length) * 100) : 0;
    const isPerfect = accuracy === 100;
    const ratedCount = Object.keys(flashcardAssessments).length;

    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[40px] p-10 shadow-xl border border-emerald-50 space-y-8"
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
            <h2 className="text-4xl font-black text-slate-800 tracking-tight">
              {isPerfect ? "Tuyệt vời! ✨" : accuracy >= 80 ? "Rất tốt! 👏" : accuracy >= 50 ? "Khá lắm! 👍" : "Cố gắng lên! 💪"}
            </h2>
            <p className="text-slate-500 font-medium">
              Bạn đã hoàn thành bài học {selectedTopic === QUICK_QUIZ_TOPIC ? "thử thách 10 từ vựng" : "chủ đề này"}.
            </p>
          </div>

          {studyMode === "flashcard" ? (
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="py-6 px-4 bg-emerald-50 rounded-3xl space-y-1">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Độ chính xác</p>
                <div className="text-3xl font-black text-emerald-700">{accuracy}%</div>
              </div>
              <div className="py-6 px-4 bg-slate-50 rounded-3xl space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Số câu đúng</p>
                <div className="text-3xl font-black text-slate-700">{score}/{filtered.length}</div>
              </div>
              <div className="py-6 px-4 bg-rose-50 rounded-3xl space-y-1">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Cần cải thiện</p>
                <div className="text-3xl font-black text-rose-700">{filtered.length - score}</div>
              </div>
            </div>
          )}

          {studyMode === "flashcard" && (
            <div className="py-4 px-6 bg-emerald-900 rounded-2xl text-white">
              <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Thống kê Flashcard</p>
              <div className="text-xl font-bold">{ratedCount} / {filtered.length} từ vựng đã được đánh giá</div>
            </div>
          )}

          <div className="pt-4 space-y-3">
            <Button
              onClick={() => setView("topics")}
              className="w-full h-14 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-lg shadow-lg border-none"
            >
              Quay lại trang chủ học tập
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                reset();
                setView("study");
              }}
              className="w-full h-12 text-emerald-600 font-bold hover:bg-emerald-50"
            >
              Học lại ngay
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (view === "topics") {
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
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.div whileHover={{ y: -5 }} className="cursor-pointer group" onClick={startReviewSRS}>
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
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="cursor-pointer group" onClick={startQuickQuiz}>
            <Card className="h-full border-none shadow-lg shadow-amber-200/50 hover:shadow-amber-400/50 transition-all overflow-hidden rounded-[32px] bg-linear-to-br from-amber-500 to-amber-600 border-b-8 border-amber-700">
              <CardHeader className="p-6 text-center">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white group-hover:scale-110 transition-transform">
                  <Trophy className="w-7 h-7" />
                </div>
                <CardTitle className="text-xl font-bold text-white">Kiểm tra nhanh</CardTitle>
                <CardDescription className="text-amber-100/60 font-medium tracking-wide uppercase text-[10px] mt-1">10 từ ngẫu nhiên</CardDescription>
              </CardHeader>
            </Card>
          </motion.div>

          {showAllTopicsCard && (
            <motion.div whileHover={{ y: -5 }} className="cursor-pointer group" onClick={() => selectTopic(DEFAULT_TOPIC_FILTER)}>
              <Card className="h-full border-none shadow-lg shadow-slate-200/50 hover:shadow-emerald-200/50 transition-all overflow-hidden rounded-[32px] bg-emerald-900 border-b-8 border-emerald-700">
                <CardHeader className="p-6 text-center">
                  <div className="w-14 h-14 bg-emerald-50/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-400 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-7 h-7" />
                  </div>
                  <CardTitle className="text-xl font-bold text-white">Tất cả bài học</CardTitle>
                  <CardDescription className="text-emerald-300/60 text-xs mt-1">{vocabulary.length} từ vựng</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          )}

          {filteredTopics.map((topic) => {
            const topicVocabCount = topicCounts.get(topic.id) ?? 0;
            return (
              <motion.div key={topic.id} whileHover={{ y: -5 }} className="cursor-pointer group" onClick={() => selectTopic(topic.id)}>
                <Card className="h-full border-2 border-transparent bg-white shadow-lg shadow-slate-200/50 hover:shadow-emerald-100 transition-all overflow-hidden rounded-[32px] border-b-8 border-b-emerald-50 relative group-hover:border-emerald-500/20">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Brain className="w-24 h-24 text-emerald-900" />
                  </div>
                  <CardHeader className="p-6 pb-3">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-3 text-emerald-600">
                      <Layers className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-800 line-clamp-1">{topic.name}</CardTitle>
                    <CardDescription className="text-slate-400 font-medium text-xs mt-0.5">{topicVocabCount} từ vựng</CardDescription>
                  </CardHeader>
                  <CardContent className="px-6 pb-5 pt-0">
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

  if (filtered.length === 0) {
    return (
      <div className="py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-emerald-500">
          <Brain className="w-10 h-10" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xl font-bold text-slate-900">Chủ đề này chưa có từ vựng</p>
            <p className="text-slate-400 text-sm italic">Hãy thêm từ vựng vào chủ đề để bắt đầu học với Flashcard.</p>
          </div>
          <Button variant="ghost" onClick={() => setView("topics")} className="text-emerald-600 hover:text-emerald-700 font-bold">
            <ChevronLeft className="w-4 h-4 mr-2" /> Quay lại chọn chủ đề
          </Button>
        </div>
      </div>
    );
  }

  const current = filtered[currentIndex];
  const handleFlashcardRating = async (rating: FlashcardRating) => {
    if (isRating) return; // prevent double-click race condition
    setIsRating(true);

    const currentLevel = current.level ?? 0;
    const newLevel = getNextLevelFromRating(currentLevel, rating);
    const nextReview = getNextReviewDate(newLevel);

    // Skip Firestore write if nothing actually changes
    // (e.g., mastered word at maxLevel rated "easy" again keeps level=maxLevel, nextReview=null)
    const existingNextReview = resolveReviewDate(current.nextReview);
    const levelUnchanged = newLevel === currentLevel;
    const reviewUnchanged = nextReview === null && existingNextReview === null;
    const isNoOp = levelUnchanged && reviewUnchanged;

    if (!isNoOp) {
      try {
        await updateDoc(doc(db, "vocabularies", current.id), {
          level: newLevel,
          nextReview: nextReview ?? null,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `vocabularies/${current.id}`);
        console.error("SRS Update Error:", err);
        setIsRating(false);
        return;
      }
    }

    setFlashcardAssessments((prev) => ({
      ...prev,
      [current.id]: {
        rating,
        newLevel,
        nextReview
      }
    }));

    setIsRating(false);
    next();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 w-full flex flex-col flex-grow">
      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .cursor-blink-anim {
          animation: cursor-blink 1.2s step-end infinite;
        }
      `}</style>

      <div className="space-y-4">
        {/* Breadcrumb & Tab Toggle */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("topics")}
            className="text-[#006c49] hover:bg-[#ECFDF5] hover:text-[#006c49] p-2 rounded-full h-auto flex items-center group font-semibold text-sm border-none"
          >
            <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
            Danh sách chủ đề
          </Button>

          <div className="bg-white border border-slate-200/60 p-1 rounded-full flex gap-1 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full px-4 py-1.5 h-8 text-xs font-bold transition-all border-none cursor-pointer",
                studyMode === "flashcard"
                  ? "bg-[#006c49] text-white hover:bg-[#006c49]/90 hover:text-white shadow-sm"
                  : "text-slate-500 hover:bg-[#ECFDF5]"
              )}
              onClick={() => setStudyMode("flashcard")}
            >
              Flashcard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full px-4 py-1.5 h-8 text-xs font-bold transition-all border-none cursor-pointer",
                studyMode === "quiz"
                  ? "bg-[#006c49] text-white hover:bg-[#006c49]/90 hover:text-white shadow-sm"
                  : "text-slate-500 hover:bg-[#ECFDF5]"
              )}
              onClick={() => setStudyMode("quiz")}
            >
              Điền từ
            </Button>
          </div>
        </div>

        {/* Topic Info Header */}
        <div className="flex justify-between items-end gap-4 mt-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              {selectedTopic === DEFAULT_TOPIC_FILTER
                ? "Tất cả bài học"
                : selectedTopic === QUICK_QUIZ_TOPIC
                  ? "Kiểm tra nhanh"
                  : selectedTopic === SRS_REVIEW_TOPIC
                    ? "Ôn tập đến hạn"
                    : topics.find((t) => t.id === selectedTopic)?.name}
            </h2>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {selectedTopic === SRS_REVIEW_TOPIC
                ? "Thuật toán SRS"
                : selectedTopic === QUICK_QUIZ_TOPIC
                  ? "Thử thách 10 từ vựng"
                  : "Đang ôn tập"}
            </span>
          </div>
          <div className="bg-[#10b981]/25 text-[#006c49] px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
            {currentIndex + 1} / {filtered.length} {studyMode === "flashcard" ? "THẺ" : "CÂU"}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-slate-200">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / filtered.length) * 100}%` }}
            className="h-full bg-[#10b981] rounded-full transition-all duration-500"
          />
        </div>
      </div>

      {/* Central Interactive Card & Nav Arrows */}
      <div className="flex-grow flex items-center justify-center relative w-full mt-4 min-h-[420px]">
        {/* Left Arrow on Desktop */}
        <Button
          variant="outline"
          size="icon"
          className="hidden md:flex absolute -left-16 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center bg-white rounded-full border border-slate-200 text-[#006c49] hover:bg-[#ECFDF5] active:scale-95 transition-all shadow-[0px_4px_20px_rgba(15,23,42,0.08)] disabled:opacity-30 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {/* Central Card */}
        <div className="w-full max-w-2xl flex-grow flex flex-col justify-center">
          {studyMode === "flashcard" ? (
            <div className="relative h-[420px] perspective-1000 w-full">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
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
                className="w-full h-full cursor-pointer relative rounded-xl"
                style={{ transformStyle: "preserve-3d" }}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Front Side */}
                <div className="absolute inset-0 backface-hidden w-full h-full rounded-xl bg-white border border-slate-200 p-6 flex flex-col items-center justify-center text-center shadow-[0px_4px_20px_rgba(15,23,42,0.08)] overflow-hidden">
                  <div className="absolute top-6 left-6 opacity-[0.03]">
                    <BookOpen className="w-32 h-32 text-slate-800" />
                  </div>
                  <div className="absolute top-4 left-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Flashcard Mode
                  </div>

                  <Badge variant="outline" className="mb-6 rounded-lg border-[#ECFDF5] bg-[#ECFDF5] text-[#006c49] text-xs font-bold uppercase tracking-wider px-3 py-1 border-none shadow-sm">
                    {current.partOfSpeech || "Vocabulary"}
                  </Badge>
                  
                  <div className="flex items-center gap-3 mb-2 flex-wrap justify-center">
                    <h2 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight">{current.word}</h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-10 h-10 rounded-full text-[#10b981] hover:bg-[#ECFDF5] hover:text-[#006c49] transition-all border-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        playAudio(current.word);
                      }}
                    >
                      <Volume2 className="w-6 h-6" />
                    </Button>
                  </div>
                  <p className="text-lg font-medium text-slate-400 italic mb-10">/ {current.phonetic} /</p>

                  <div className="flex items-center gap-2 text-slate-400/80 animate-pulse mt-4">
                    <Brain className="w-4 h-4 text-[#10b981]" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest">Nhấn để xem nghĩa tiếng Việt</span>
                  </div>
                </div>

                {/* Back Side */}
                <div
                  className="absolute inset-0 backface-hidden w-full h-full rounded-xl bg-[#006c49] border border-[#006c49] p-6 flex flex-col items-center justify-center text-center shadow-[0px_4px_20px_rgba(15,23,42,0.08)]"
                  style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
                >
                  <div className="absolute top-6 right-6 opacity-5">
                    <Brain className="w-32 h-32 text-white" />
                  </div>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-4">Nghĩa Tiếng Việt</p>
                  <h3 className="text-3xl sm:text-4xl font-bold text-white leading-relaxed tracking-tight px-4 max-h-[160px] overflow-y-auto">
                    {current.definition}
                  </h3>

                  <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                    <Button
                      disabled={isRating}
                      className="h-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider border-none shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => handleFlashcardRating("again")}
                    >
                      Again
                    </Button>
                    <Button
                      disabled={isRating}
                      className="h-10 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider border-none shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => handleFlashcardRating("hard")}
                    >
                      Hard
                    </Button>
                    <Button
                      disabled={isRating}
                      className="h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider border-none shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => handleFlashcardRating("good")}
                    >
                      Good
                    </Button>
                    <Button
                      disabled={isRating}
                      className="h-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs uppercase tracking-wider border-none shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => handleFlashcardRating("easy")}
                    >
                      Easy
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            <motion.div
              key={`quiz-${currentIndex}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-between shadow-[0px_4px_20px_rgba(15,23,42,0.08)] min-h-[420px]"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                FILL IN THE BLANKS
              </span>

              <div className="text-center mb-6">
                <p className="text-xs font-bold text-[#10b981] mb-2 uppercase tracking-wide">
                  NGHĨA TIẾNG VIỆT
                </p>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                  {current.definition}
                </h3>
              </div>

              {/* Visual Underscores & Hidden Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (feedback === "correct") {
                    next();
                  } else {
                    handleSubmit(checkAnswer)(e);
                  }
                }}
                className="w-full flex-grow flex flex-col justify-between items-center"
              >
                <div className="w-full max-w-xs flex flex-col items-center gap-2 my-auto">
                  <div
                    onClick={() => hiddenInputRef.current?.focus()}
                    className="relative w-full flex justify-center items-center h-14 cursor-text"
                  >
                    <input
                      type="text"
                      autoFocus
                      maxLength={current.word.length}
                      className="absolute inset-0 opacity-0 cursor-default w-full h-full z-10"
                      value={userAnswer}
                      {...userAnswerRest}
                      onCompositionStart={() => setIsComposing(true)}
                      onCompositionEnd={(e) => {
                        setIsComposing(false);
                        const val = e.currentTarget.value;
                        const limit = current.word.length;
                        if (val.length > limit) {
                          const truncated = val.slice(0, limit);
                          e.currentTarget.value = truncated;
                          setValue("userAnswer", truncated, { shouldDirty: true, shouldValidate: true });
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        const limit = current.word.length;
                        if (!isComposing && val.length > limit) {
                          const truncated = val.slice(0, limit);
                          e.target.value = truncated;
                        }
                        userAnswerRest.onChange(e);
                      }}
                      ref={(e) => {
                        userAnswerRef(e);
                        (hiddenInputRef as any).current = e;
                      }}
                    />

                    {/* Styled underscored blocks */}
                    <div className="flex gap-1.5 flex-wrap justify-center">
                      {Array.from({ length: current.word.length }).map((_, index) => {
                        const char = userAnswer[index] || "";
                        const isActive = index === userAnswer.length;
                        const isFilled = index < userAnswer.length;
                        const isSpace = current.word[index] === " ";

                        if (isSpace) {
                          return <div key={index} className="w-4 h-12" />;
                        }

                        return (
                          <div
                            key={index}
                            className={cn(
                              "w-8 h-12 border-b-2 flex items-center justify-center transition-all duration-150",
                              feedback === "correct"
                                ? "border-emerald-500 text-emerald-700"
                                : feedback === "incorrect"
                                  ? "border-rose-500 text-rose-700"
                                  : isActive
                                    ? "border-[#10b981] bg-[#ECFDF5]/10"
                                    : isFilled
                                      ? "border-slate-800"
                                      : "border-slate-200/60"
                            )}
                          >
                            {char ? (
                              <span className={cn(
                                "text-[28px] font-bold",
                                feedback === "correct"
                                  ? "text-[#006c49]"
                                  : feedback === "incorrect"
                                    ? "text-rose-600"
                                    : "text-slate-800"
                              )}>
                                {char}
                              </span>
                            ) : isActive && !feedback ? (
                              <div className="h-6 w-[2px] bg-[#006c49] cursor-blink-anim" />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider mt-2 text-slate-400">
                    {Math.min(userAnswer.trim().length, current.word.length)}/{current.word.length} CHỮ
                  </span>

                  {errors.userAnswer && (
                    <p className="text-xs text-rose-500 font-medium text-center mt-1">
                      {errors.userAnswer.message}
                    </p>
                  )}
                  {feedback === "incorrect" && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-xs font-semibold text-rose-500 mt-1"
                    >
                      Gợi ý: Từ này bắt đầu bằng chữ <span className="font-bold text-rose-700">"{current.word[0].toUpperCase()}"</span>
                    </motion.p>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="mt-auto w-full flex flex-col gap-3">
                  {feedback === "correct" ? (
                    <Button
                      type="button"
                      onClick={next}
                      className="w-full py-6 bg-[#10b981] hover:bg-[#10b981]/90 text-white font-semibold text-sm rounded-full shadow-sm active:scale-95 transition-all duration-200 border-none cursor-pointer"
                    >
                      Làm tiếp câu khác
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      className="w-full py-6 bg-[#10b981] hover:bg-[#10b981]/90 text-white font-semibold text-sm rounded-full shadow-sm active:scale-95 transition-all duration-200 border-none cursor-pointer disabled:opacity-50"
                    >
                      Kiểm tra kết quả
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full py-2 text-slate-400 hover:text-[#006c49] font-bold text-xs uppercase tracking-widest hover:bg-transparent cursor-pointer border-none"
                    onClick={() => {
                      setValue("userAnswer", current.word, { shouldDirty: true, shouldValidate: true });
                      setFeedback("correct");
                    }}
                  >
                    XEM ĐÁP ÁN
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </div>

        {/* Right Arrow on Desktop */}
        <Button
          variant="outline"
          size="icon"
          className="hidden md:flex absolute -right-16 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center bg-white rounded-full border border-slate-200 text-[#006c49] hover:bg-[#ECFDF5] active:scale-95 transition-all shadow-[0px_4px_20px_rgba(15,23,42,0.08)] disabled:opacity-30 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
        >
          {currentIndex === filtered.length - 1 ? <Check className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Navigation Helpers */}
      <div className="flex md:hidden justify-center gap-6 mt-6">
        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 flex items-center justify-center bg-white rounded-full border border-slate-200 text-[#006c49] active:scale-90 transition-all shadow-sm disabled:opacity-30"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 flex items-center justify-center bg-white rounded-full border border-slate-200 text-[#006c49] active:scale-90 transition-all shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
        >
          {currentIndex === filtered.length - 1 ? <Check className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </Button>
      </div>
    </div>
  );
}
