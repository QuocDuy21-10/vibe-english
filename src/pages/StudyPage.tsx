import { StudyArea } from "@/components/features/StudyArea";
import { useAppData } from "@/routes/AppDataProvider";

export function StudyPage() {
  const { vocabularies, topics } = useAppData();

  return <StudyArea vocabulary={vocabularies} topics={topics} />;
}
