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

export type VocabularyStatusFilter = "all" | "due" | "new" | "learning" | "mastered";

export type VocabularySortOption =
  | "newest"
  | "oldest"
  | "alpha-asc"
  | "alpha-desc"
  | "next-review"
  | "level-desc"
  | "level-asc";

export type FilterAndSortOptions = {
  searchQuery?: string;
  selectedTopicId?: string;
  statusFilter?: VocabularyStatusFilter;
  sortOption?: VocabularySortOption;
  now?: Date;
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
      vocabulary.partOfSpeech.toLowerCase().includes(queryText) ||
      vocabulary.phonetic.toLowerCase().includes(queryText);
    const matchesTopic =
      selectedTopicId === DEFAULT_TOPIC_FILTER ||
      (selectedTopicId === UNASSIGNED_TOPIC_FILTER
        ? !vocabulary.topicId
        : vocabulary.topicId === selectedTopicId);

    return matchesSearch && matchesTopic;
  });
}

export function sortVocabularies(
  vocabularies: Vocabulary[],
  sortOption: VocabularySortOption = "newest"
): Vocabulary[] {
  const copy = [...vocabularies];

  switch (sortOption) {
    case "oldest":
      return copy.sort((a, b) => {
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toMillis?.() || 0;
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toMillis?.() || 0;
        return timeA - timeB;
      });

    case "alpha-asc":
      return copy.sort((a, b) => a.word.localeCompare(b.word));

    case "alpha-desc":
      return copy.sort((a, b) => b.word.localeCompare(a.word));

    case "next-review":
      return copy.sort((a, b) => {
        const timeA = a.nextReview ? (a.nextReview instanceof Date ? a.nextReview.getTime() : (a.nextReview as any)?.toMillis?.() || 0) : Number.MAX_SAFE_INTEGER;
        const timeB = b.nextReview ? (b.nextReview instanceof Date ? b.nextReview.getTime() : (b.nextReview as any)?.toMillis?.() || 0) : Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
      });

    case "level-desc":
      return copy.sort((a, b) => {
        const levelDiff = getVocabularyLevel(b) - getVocabularyLevel(a);
        if (levelDiff !== 0) return levelDiff;
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toMillis?.() || 0;
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toMillis?.() || 0;
        return timeB - timeA;
      });

    case "level-asc":
      return copy.sort((a, b) => {
        const levelDiff = getVocabularyLevel(a) - getVocabularyLevel(b);
        if (levelDiff !== 0) return levelDiff;
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toMillis?.() || 0;
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toMillis?.() || 0;
        return timeB - timeA;
      });

    case "newest":
    default:
      return copy.sort((a, b) => {
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toMillis?.() || 0;
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toMillis?.() || 0;
        return timeB - timeA;
      });
  }
}

export function filterAndSortVocabularies(
  vocabularies: Vocabulary[],
  options: FilterAndSortOptions
): Vocabulary[] {
  const {
    searchQuery = "",
    selectedTopicId = DEFAULT_TOPIC_FILTER,
    statusFilter = "all",
    sortOption = "newest",
    now = new Date()
  } = options;

  // 1. Topic and Search Filter
  let filtered = filterVocabularies(vocabularies, searchQuery, selectedTopicId);

  // 2. Status Filter
  if (statusFilter !== "all") {
    filtered = filtered.filter((vocab) => {
      const level = getVocabularyLevel(vocab);
      switch (statusFilter) {
        case "due":
          return isDueForReview(vocab, now);
        case "new":
          return level === 0;
        case "learning":
          return level >= 1 && level <= 3;
        case "mastered":
          return level === 4;
        default:
          return true;
      }
    });
  }

  // 3. Sort
  return sortVocabularies(filtered, sortOption);
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

export function getTopicTimestamp(topic: Topic): number {
  const createdAt = topic.createdAt as any;
  if (!createdAt) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (createdAt instanceof Date) {
    return createdAt.getTime();
  }
  if (typeof createdAt.toMillis === "function") {
    return createdAt.toMillis();
  }
  if (typeof createdAt.seconds === "number") {
    return createdAt.seconds * 1000;
  }
  if (typeof createdAt === "number") {
    return createdAt;
  }
  if (typeof createdAt === "string") {
    const parsed = Date.parse(createdAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

export function sortTopicsByNewest(topics: Topic[]) {
  return topics.slice().sort((a, b) => {
    const timeA = getTopicTimestamp(a);
    const timeB = getTopicTimestamp(b);
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return a.name.localeCompare(b.name);
  });
}

export function sortTopicsByName(topics: Topic[]) {
  return topics.slice().sort((first, second) => first.name.localeCompare(second.name));
}
