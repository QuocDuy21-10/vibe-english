import { useMemo, useState } from "react";
import { Brain, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { StudyExitConfirmDialog } from "@/components/features/study/StudyExitConfirmDialog";
import { StudySessionView } from "@/components/features/study/StudySessionView";
import { StudySummary } from "@/components/features/study/StudySummary";
import { StudyTopicPicker } from "@/components/features/study/StudyTopicPicker";
import { Button } from "@/components/ui/button";
import { DEFAULT_TOPIC_FILTER, QUICK_QUIZ_TOPIC, SRS_REVIEW_TOPIC, UNASSIGNED_TOPIC_FILTER } from "@/constants/vocab";
import { useTopicVocabularyCounts } from "@/hooks/useVocabStats";
import {
  calculateNextSchedule,
  normalizeSchedule,
  requeueAgainOnce,
  type FlashcardRating
} from "@/lib/srs";
import { getDueCount, getDueVocabularies } from "@/lib/vocabularySelectors";
import { useAppData } from "@/routes/AppDataProvider";
import { recordVocabularyReview } from "@/services/vocabularyRepository";
import type { Topic, Vocabulary, StudySession } from "@/types/types";

type StudyAreaProps = {
  vocabulary: Vocabulary[];
  topics: Topic[];
};

type StudyView = "topics" | "study" | "summary";
type StudyMode = "flashcard" | "quiz";
type QuizFeedback = "correct" | "incorrect" | null;

type FlashcardAssessment = {
  rating: FlashcardRating;
  newLevel: number;
  nextReview: Date;
};

export function StudyArea({ vocabulary, topics }: StudyAreaProps) {
  const { user } = useAppData();
  const [selectedTopic, setSelectedTopic] = useState(DEFAULT_TOPIC_FILTER);
  const [view, setView] = useState<StudyView>("topics");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("flashcard");
  const [feedback, setFeedback] = useState<QuizFeedback>(null);
  const [sessionVocab, setSessionVocab] = useState<Vocabulary[]>([]);
  const [score, setScore] = useState(0);
  const [flashcardAssessments, setFlashcardAssessments] = useState<FlashcardAssessment[]>([]);
  const [sessionStats, setSessionStats] = useState<StudySession>({
    initialCount: 0,
    completedCount: 0,
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0
  });
  const [attemptedWords, setAttemptedWords] = useState<Set<string>>(new Set());
  const [requeuedIds, setRequeuedIds] = useState<Set<string>>(new Set());
  const [pendingVocabId, setPendingVocabId] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const filtered = useMemo(
    () =>
      sessionVocab.length > 0
        ? sessionVocab
        : vocabulary.filter((item) => {
            if (selectedTopic === DEFAULT_TOPIC_FILTER) return true;
            if (selectedTopic === UNASSIGNED_TOPIC_FILTER) return !item.topicId;
            return item.topicId === selectedTopic;
          }),
    [sessionVocab, selectedTopic, vocabulary]
  );

  const dueCount = useMemo(() => getDueCount(vocabulary), [vocabulary]);

  const flashcardStats = useMemo(() => {
    const stats: Record<FlashcardRating, number> = { again: 0, hard: 0, good: 0, easy: 0 };
    flashcardAssessments.forEach((assessment) => {
      stats[assessment.rating] += 1;
    });
    return stats;
  }, [flashcardAssessments]);

  const topicCounts = useTopicVocabularyCounts(vocabulary);

  const safeCurrentIndex = Math.min(currentIndex, Math.max(0, filtered.length - 1));

  const resetCardState = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setFeedback(null);
  };

  const resetAssessmentState = () => {
    setFlashcardAssessments([]);
    setAttemptedWords(new Set());
    setRequeuedIds(new Set());
    setPendingVocabId(null);
  };

  const beginSession = (topicId: string, mode: StudyMode, items: Vocabulary[] = []) => {
    const resolvedItems =
      items.length > 0
        ? items
        : vocabulary.filter((item) => {
            if (topicId === DEFAULT_TOPIC_FILTER) return true;
            if (topicId === UNASSIGNED_TOPIC_FILTER) return !item.topicId;
            return item.topicId === topicId;
          });

    setSelectedTopic(topicId);
    setStudyMode(mode);
    setSessionVocab(items);
    setScore(0);
    setSessionStats({
      initialCount: resolvedItems.length,
      completedCount: 0,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      easyCount: 0
    });
    resetCardState();
    resetAssessmentState();
    setView("study");
  };

  const startQuickQuiz = () => {
    const shuffled = [...vocabulary].sort(() => 0.5 - Math.random());
    beginSession(QUICK_QUIZ_TOPIC, "quiz", shuffled.slice(0, 10));
  };

  const startSrsReview = () => {
    const due = getDueVocabularies(vocabulary);

    if (due.length === 0) {
      toast.info("Bạn đã hoàn thành toàn bộ từ cần ôn hôm nay. ✨");
      return;
    }

    beginSession(SRS_REVIEW_TOPIC, "flashcard", due);
  };

  const startTopicSession = (topicId: string) => {
    beginSession(topicId, "flashcard");
  };

  const switchStudyMode = (mode: StudyMode) => {
    if (mode === studyMode) return;
    setStudyMode(mode);
    resetCardState();
    resetAssessmentState();
  };

  const returnToTopics = () => {
    setSessionVocab([]);
    setScore(0);
    resetCardState();
    resetAssessmentState();
    setView("topics");
  };

  const restartSession = () => {
    resetCardState();
    resetAssessmentState();
    setView("study");
  };


  const next = (queueLength = filtered.length) => {
    if (safeCurrentIndex < queueLength - 1) {
      setCurrentIndex(safeCurrentIndex + 1);
      setIsFlipped(false);
      setFeedback(null);
    } else {
      setView("summary");
    }
  };

  const previous = () => {
    if (safeCurrentIndex === 0) return;
    setCurrentIndex(safeCurrentIndex - 1);
    setIsFlipped(false);
    setFeedback(null);
  };

  const checkAnswer = (answer: string) => {
    const currentVocabulary = filtered[safeCurrentIndex];
    const trimmedAnswer = answer.trim();
    if (!currentVocabulary || !trimmedAnswer) return;

    const isCorrect = trimmedAnswer.toLowerCase() === currentVocabulary.word.trim().toLowerCase();
    if (!feedback && !attemptedWords.has(currentVocabulary.id)) {
      setAttemptedWords((previousWords) => new Set(previousWords).add(currentVocabulary.id));
      if (isCorrect) setScore((previousScore) => previousScore + 1);
    }

    setFeedback(isCorrect ? "correct" : "incorrect");
    if (isCorrect) {
      toast.success("Chính xác! ✨");
    } else {
      toast.error("Chưa đúng rồi, hãy thử lại nhé!");
    }
  };

  if (view === "summary") {
    return (
      <StudySummary
        studyMode={studyMode}
        selectedTopic={selectedTopic}
        itemCount={filtered.length}
        score={score}
        flashcardStats={flashcardStats}
        ratedCount={flashcardAssessments.length}
        sessionStats={sessionStats}
        onReturnToTopics={returnToTopics}
        onRestart={restartSession}
      />
    );
  }

  if (view === "topics") {
    return (
      <StudyTopicPicker
        topics={topics}
        vocabularies={vocabulary}
        vocabularyCount={vocabulary.length}
        dueCount={dueCount}
        searchQuery={searchQuery}
        topicCounts={topicCounts}
        onSearchChange={setSearchQuery}
        onStartSrsReview={startSrsReview}
        onStartQuickQuiz={startQuickQuiz}
        onSelectTopic={startTopicSession}
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-[#006c49]">
          <Brain className="w-10 h-10" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xl font-bold text-slate-900">Chủ đề này chưa có từ vựng</p>
            <p className="text-slate-400 text-sm italic">Hãy thêm từ vựng vào chủ đề để bắt đầu học với Flashcard.</p>
          </div>
          <Button variant="ghost" onClick={returnToTopics} className="text-[#006c49] hover:text-[#006c49]/80 font-bold">
            <ChevronLeft className="w-4 h-4 mr-2" /> Quay lại chọn chủ đề
          </Button>
        </div>
      </div>
    );
  }

  const current = filtered[safeCurrentIndex];
  const handleFlashcardRating = async (rating: FlashcardRating) => {
    if (pendingVocabId === current.id) return;
    if (!user) {
      toast.error("Vui lòng đăng nhập để lưu kết quả ôn tập.");
      return;
    }
    setPendingVocabId(current.id);

    const reviewedAt = new Date();
    const schedule = calculateNextSchedule(normalizeSchedule(current, reviewedAt), rating, reviewedAt);

    try {
      await recordVocabularyReview({
        vocabulary: current,
        schedule,
        rating,
        userId: user.uid
      });

      setFlashcardAssessments((previousAssessments) => [
        ...previousAssessments,
        { rating, newLevel: schedule.level, nextReview: schedule.nextReview }
      ]);

      setSessionStats((prev) => ({
        ...prev,
        completedCount: prev.completedCount + 1,
        againCount: rating === "again" ? prev.againCount + 1 : prev.againCount,
        hardCount: rating === "hard" ? prev.hardCount + 1 : prev.hardCount,
        goodCount: rating === "good" ? prev.goodCount + 1 : prev.goodCount,
        easyCount: rating === "easy" ? prev.easyCount + 1 : prev.easyCount
      }));

      let queueLength = filtered.length;
      if (rating === "again") {
        const updatedCard = { ...current, ...schedule };
        const requeueResult = requeueAgainOnce(filtered, updatedCard, requeuedIds);
        setSessionVocab(requeueResult.queue);
        setRequeuedIds(requeueResult.requeuedIds);
        queueLength = requeueResult.queue.length;
      }

      next(queueLength);
    } catch {
      toast.error("Không thể lưu kết quả ôn tập. Vui lòng thử lại.");
    } finally {
      setPendingVocabId((pendingId) => (pendingId === current.id ? null : pendingId));
    }
  };


  const title =
    selectedTopic === DEFAULT_TOPIC_FILTER
      ? "Tất cả bài học"
      : selectedTopic === UNASSIGNED_TOPIC_FILTER
        ? "Chưa phân loại"
        : selectedTopic === QUICK_QUIZ_TOPIC
          ? "Kiểm tra nhanh"
          : selectedTopic === SRS_REVIEW_TOPIC
            ? "Ôn tập đến hạn"
            : topics.find((topic) => topic.id === selectedTopic)?.name || "Chủ đề";
  const subtitle =
    selectedTopic === SRS_REVIEW_TOPIC
      ? "Thuật toán SRS"
      : selectedTopic === QUICK_QUIZ_TOPIC
        ? "Thử thách 10 từ vựng"
        : "Đang ôn tập";

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    returnToTopics();
  };

  return (
    <>
      <StudySessionView
        vocabulary={current}
        currentIndex={safeCurrentIndex}
        itemCount={filtered.length}
        studyMode={studyMode}
        title={title}
        subtitle={subtitle}
        isFlipped={isFlipped}
        isPending={pendingVocabId === current.id}
        feedback={feedback}
        onReturnToTopics={() => setShowExitConfirm(true)}
        onModeChange={switchStudyMode}
        onPrevious={previous}
        onNext={() => next()}
        onFlip={() => setIsFlipped((flipped) => !flipped)}
        onRate={(rating) => void handleFlashcardRating(rating)}
        onAnswerChange={() => {
          if (feedback) setFeedback(null);
        }}
        onCheckAnswer={checkAnswer}
        onRevealAnswer={() => setFeedback("correct")}
      />
      <StudyExitConfirmDialog
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirmExit={handleConfirmExit}
      />
    </>
  );
}
