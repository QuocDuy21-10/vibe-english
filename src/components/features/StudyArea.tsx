import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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
  const [isSavingAssessments, setIsSavingAssessments] = useState(false);
  const [hasCommittedAssessments, setHasCommittedAssessments] = useState(false);
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
      setIsSavingAssessments(false);
      setHasCommittedAssessments(false);
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

  useEffect(() => {
    if (view !== "summary" || studyMode !== "flashcard") return;
    if (hasCommittedAssessments) return;

    const entries = Object.entries(flashcardAssessments);
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
              {isSavingAssessments && <p className="text-xs uppercase tracking-widest opacity-60 mt-2">Đang lưu kết quả...</p>}
            </div>
          )}

          <div className="pt-4 space-y-3">
            <Button
              onClick={() => setView("topics")}
              disabled={studyMode === "flashcard" && isSavingAssessments}
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
              disabled={studyMode === "flashcard" && isSavingAssessments}
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
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div whileHover={{ y: -5 }} className="cursor-pointer group" onClick={startReviewSRS}>
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

          <motion.div whileHover={{ y: -5 }} className="cursor-pointer group" onClick={startQuickQuiz}>
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
            <motion.div whileHover={{ y: -5 }} className="cursor-pointer group" onClick={() => selectTopic(DEFAULT_TOPIC_FILTER)}>
              <Card className="h-full border-none shadow-lg shadow-slate-200/50 hover:shadow-emerald-200/50 transition-all overflow-hidden rounded-[32px] bg-emerald-900 border-b-8 border-emerald-700">
                <CardHeader className="pt-8 pb-4 text-center">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <CardTitle className="text-xl font-bold text-white">Tất cả bài học</CardTitle>
                  <CardDescription className="text-emerald-300/60">{vocabulary.length} từ vựng</CardDescription>
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
  const handleFlashcardRating = (rating: FlashcardRating) => {
    const currentLevel = current.level ?? 0;
    const newLevel = getNextLevelFromRating(currentLevel, rating);
    const nextReview = getNextReviewDate(newLevel);

    setFlashcardAssessments((prev) => ({
      ...prev,
      [current.id]: {
        rating,
        newLevel,
        nextReview
      }
    }));

    next();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" onClick={() => setView("topics")} className="text-slate-400 hover:text-emerald-600 p-0 h-auto">
            <ChevronLeft className="w-4 h-4 mr-1" /> Danh sách chủ đề
          </Button>

          <div className="flex items-center p-1 bg-white rounded-xl border border-emerald-100 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg px-4 h-9 ${studyMode === "flashcard" ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white" : "text-slate-500"}`}
              onClick={() => setStudyMode("flashcard")}
            >
              Flashcard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg px-4 h-9 ${studyMode === "quiz" ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white" : "text-slate-500"}`}
              onClick={() => setStudyMode("quiz")}
            >
              Điền từ
            </Button>
          </div>
          <div className="w-25" />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">
              {selectedTopic === DEFAULT_TOPIC_FILTER
                ? "Tất cả bài học"
                : selectedTopic === QUICK_QUIZ_TOPIC
                  ? "Kiểm tra nhanh"
                  : selectedTopic === SRS_REVIEW_TOPIC
                    ? "Ôn tập đến hạn"
                    : topics.find((t) => t.id === selectedTopic)?.name}
            </h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              {selectedTopic === SRS_REVIEW_TOPIC
                ? "Thuật toán SRS Spaced Repetition"
                : selectedTopic === QUICK_QUIZ_TOPIC
                  ? "Thử thách 10 từ vựng"
                  : "Đang ôn tập"}
            </p>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 tracking-widest uppercase bg-emerald-100 px-3 py-1 rounded-full">
            {currentIndex + 1} / {filtered.length} {studyMode === "flashcard" ? "THẺ" : "CÂU"}
          </span>
        </div>
        <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / filtered.length) * 100}%` }}
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-8 justify-center min-h-125">
        <Button
          variant="outline"
          size="icon"
          className="hidden sm:flex w-14 h-14 rounded-full bg-white border-none shadow-lg shadow-emerald-100 ring-1 ring-emerald-50 hover:-translate-y-0.5 transition-all disabled:opacity-30 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-6 h-6 text-emerald-600" />
        </Button>

        <div className="flex-1 max-w-2xl">
          {studyMode === "flashcard" ? (
            <div className="relative h-120 perspective-1000">
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
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div className="absolute inset-0 backface-hidden w-full h-full rounded-[40px] bg-white flex flex-col items-center justify-center p-8 text-center border-b-8 border-emerald-400 overflow-hidden shadow-lg">
                  <motion.div animate={{ opacity: isFlipped ? 0 : 1, y: isFlipped ? 10 : 0 }} className="flex flex-col items-center">
                    <div className="absolute top-8 left-8 opacity-10">
                      <BookOpen className="w-20 h-20 text-emerald-500" />
                    </div>
                    <div className="absolute top-4 left-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Flashcard Mode</div>

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
                          playAudio(current.word);
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
                  className="absolute inset-0 backface-hidden w-full h-full rounded-[40px] bg-emerald-900 flex flex-col items-center justify-center p-8 text-center"
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
                          handleFlashcardRating("again");
                        }}
                      >
                        Again
                      </Button>
                      <Button
                        className="h-11 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFlashcardRating("hard");
                        }}
                      >
                        Hard
                      </Button>
                      <Button
                        className="h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFlashcardRating("good");
                        }}
                      >
                        Good
                      </Button>
                      <Button
                        className="h-11 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFlashcardRating("easy");
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
              className="bg-white rounded-[40px] p-8 shadow-xl border border-emerald-50 h-120 flex flex-col items-center justify-between"
            >
              <div className="w-full text-center space-y-6">
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Fill in the blanks</div>
                <div className="space-y-4">
                  <p className="text-emerald-600/60 text-xs font-bold uppercase tracking-widest">Nghĩa Tiếng Việt</p>
                  <h3 className="text-3xl font-black text-slate-800 leading-tight">{current.definition}</h3>
                </div>
              </div>

              <form onSubmit={handleSubmit(checkAnswer)} className="w-full space-y-6">
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      autoFocus
                      placeholder={`${current.word.length} chữ`}
                      aria-invalid={!!errors.userAnswer}
                      {...register("userAnswer", {
                        onChange: () => {
                          if (feedback) setFeedback(null);
                        }
                      })}
                      className={`w-full h-14 text-3xl font-black text-center bg-transparent border-b-2 transition-all outline-none tracking-wide ${
                        feedback === "correct"
                          ? "border-emerald-500 text-emerald-700"
                          : feedback === "incorrect"
                            ? "border-rose-500 text-rose-700"
                            : "border-emerald-200 focus:border-emerald-500 text-slate-800"
                      }`}
                    />
                    {feedback === "correct" && (
                      <Sparkles className="absolute right-0 top-1/2 -translate-y-1/2 text-emerald-500 w-6 h-6 animate-bounce" />
                    )}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
                    {userAnswer.trim().length}/{current.word.length} chữ
                  </div>
                  {errors.userAnswer && <p className="text-xs text-rose-500 font-medium text-center">{errors.userAnswer.message}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={userAnswer.trim().length !== current.word.length}
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
                  className="text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-emerald-500"
                  onClick={() => {
                    setValue("userAnswer", current.word, { shouldDirty: true, shouldValidate: true });
                    setFeedback("correct");
                  }}
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
            next();
          }}
        >
          {currentIndex === filtered.length - 1 ? <Check className="w-6 h-6 text-emerald-600" /> : <ChevronRight className="w-6 h-6 text-emerald-600" />}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-6 pt-4 sm:hidden">
        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full bg-white border-none shadow-lg shadow-emerald-100 ring-1 ring-emerald-50 hover:-translate-y-0.5 transition-all disabled:opacity-30"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-6 h-6 text-emerald-600" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full bg-white border-none shadow-lg shadow-emerald-100 ring-1 ring-emerald-50 hover:-translate-y-0.5 transition-all disabled:opacity-30"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
        >
          {currentIndex === filtered.length - 1 ? <Check className="w-6 h-6 text-emerald-600" /> : <ChevronRight className="w-6 h-6 text-emerald-600" />}
        </Button>
      </div>
    </div>
  );
}
