import { DEFAULT_TOPIC_FILTER, LEVELS, UNASSIGNED_TOPIC_FILTER } from "@/constants/vocab";
import { getVocabularyLevel, isDueForReview } from "@/lib/srs";
import type { Topic, Vocabulary } from "@/types/types";

export function getDueVocabularies(vocabularies: Vocabulary[], now = new Date()): Vocabulary[] {
  return vocabularies.filter((vocab) => isDueForReview(vocab, now));
}

export function getDueCount(vocabularies: Vocabulary[], now = new Date()): number {
  return getDueVocabularies(vocabularies, now).length;
}


export type VocabularyOverview = {
  stats: {
    totalVocab: number;
    learnedVocab: number;
    progress: number;
    milestone: { name: string; target: number };
  };
  levelCounts: number[];
};

export function filterVocabularies(
  vocabularies: Vocabulary[],
  searchQuery: string,
  selectedTopicId: string
) {
  const queryText = searchQuery.trim().toLowerCase();
  return vocabularies.filter((vocabulary) => {
    const matchesSearch =
      queryText.length === 0 ||
      vocabulary.word.toLowerCase().includes(queryText) ||
      vocabulary.definition.toLowerCase().includes(queryText) ||
      vocabulary.partOfSpeech.toLowerCase().includes(queryText);
    const matchesTopic =
      selectedTopicId === DEFAULT_TOPIC_FILTER ||
      (selectedTopicId === UNASSIGNED_TOPIC_FILTER
        ? !vocabulary.topicId
        : vocabulary.topicId === selectedTopicId);

    return matchesSearch && matchesTopic;
  });
}

export function getVocabularyOverview(vocabularies: Vocabulary[]): VocabularyOverview {
  const levelCounts = LEVELS.map(() => 0);
  let learnedVocab = 0;

  vocabularies.forEach((vocabulary) => {
    const level = getVocabularyLevel(vocabulary);
    levelCounts[level] += 1;
    if (level === 4) learnedVocab += 1;
  });

  const totalVocab = vocabularies.length;
  const progress = totalVocab > 0 ? Math.round((learnedVocab / totalVocab) * 100) : 0;
  const milestone =
    learnedVocab < 200
      ? { name: "Chiến binh 200", target: 200 }
      : learnedVocab < 500
        ? { name: "Chuyên gia 500", target: 500 }
        : { name: "Hồng sư 1000", target: 1000 };

  return {
    stats: { totalVocab, learnedVocab, progress, milestone },
    levelCounts
  };
}

export function countVocabulariesByTopic(vocabularies: Vocabulary[]) {
  const counts = new Map<string, number>();
  vocabularies.forEach((vocabulary) => {
    if (!vocabulary.topicId) return;
    counts.set(vocabulary.topicId, (counts.get(vocabulary.topicId) ?? 0) + 1);
  });
  return counts;
}

export function sortTopicsByName(topics: Topic[]) {
  return topics.slice().sort((first, second) => first.name.localeCompare(second.name));
}
