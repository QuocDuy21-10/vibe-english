import { StudyArea } from "@/components/features/StudyArea";
import { useVocabularyData } from "@/routes/AppDataProvider";

export function StudyPage() {
  const { vocabularies, topics } = useVocabularyData();

  return <StudyArea vocabulary={vocabularies} topics={topics} />;
}
