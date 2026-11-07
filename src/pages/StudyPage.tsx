import { useMemo } from "react";
import { StudyArea } from "@/components/features/StudyArea";
import { getWeakWords } from "@/lib/learningActivity";
import { useVocabularyData } from "@/routes/AppDataProvider";
import { useLearningActivity } from "@/routes/LearningActivityProvider";

export function StudyPage() {
  const { vocabularies, topics } = useVocabularyData();
  const { items } = useLearningActivity();
  const weakVocabularies = useMemo(
    () => getWeakWords(items, vocabularies).map((weakWord) => weakWord.vocabulary),
    [items, vocabularies]
  );

  return <StudyArea vocabulary={vocabularies} topics={topics} weakVocabularies={weakVocabularies} />;
}
