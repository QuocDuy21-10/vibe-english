import { useMemo } from "react";
import { DEFAULT_TOPIC_FILTER, LEVELS, UNASSIGNED_TOPIC_FILTER } from "../constants/vocab";
import { Topic, Vocabulary } from "../types/types";

type VocabStatsInput = {
  vocabularies: Vocabulary[];
  topics: Topic[];
  searchQuery: string;
  selectedTopicId: string;
};

type VocabStatsResult = {
  filteredVocab: Vocabulary[];
  stats: {
    totalVocab: number;
    learnedVocab: number;
    progress: number;
    milestone: { name: string; target: number };
  };
  levelCounts: number[];
  topicVocabCounts: Map<string, number>;
  sortedTopics: Topic[];
};

export function useVocabStats({
  vocabularies,
  topics,
  searchQuery,
  selectedTopicId,
}: VocabStatsInput): VocabStatsResult {
  const filteredVocab = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    return vocabularies.filter((v) => {
      const matchesSearch =
        queryText.length === 0 ||
        v.word.toLowerCase().includes(queryText) ||
        v.definition.toLowerCase().includes(queryText) ||
        (v.partOfSpeech && v.partOfSpeech.toLowerCase().includes(queryText));

      const matchesTopic =
        selectedTopicId === DEFAULT_TOPIC_FILTER ||
        (selectedTopicId === UNASSIGNED_TOPIC_FILTER ? !v.topicId : v.topicId === selectedTopicId);

      return matchesSearch && matchesTopic;
    });
  }, [searchQuery, selectedTopicId, vocabularies]);

  const stats = useMemo(() => {
    const totalVocab = vocabularies.length;
    const learnedVocab = vocabularies.filter((v) => (v.level || 0) === 4).length;
    const progress = totalVocab > 0 ? Math.round((learnedVocab / totalVocab) * 100) : 0;

    const milestone =
      learnedVocab < 200
        ? { name: "Chiến binh 200", target: 200 }
        : learnedVocab < 500
          ? { name: "Chuyên gia 500", target: 500 }
          : { name: "Hồng sư 1000", target: 1000 };

    return { totalVocab, learnedVocab, progress, milestone };
  }, [vocabularies]);

  const levelCounts = useMemo(
    () => LEVELS.map((level) => vocabularies.filter((v) => (v.level || 0) === level).length),
    [vocabularies]
  );

  const topicVocabCounts = useMemo(() => {
    const counts = new Map<string, number>();
    vocabularies.forEach((v) => {
      if (!v.topicId) return;
      counts.set(v.topicId, (counts.get(v.topicId) ?? 0) + 1);
    });
    return counts;
  }, [vocabularies]);

  const sortedTopics = useMemo(
    () => topics.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [topics]
  );

  return { filteredVocab, stats, levelCounts, topicVocabCounts, sortedTopics };
}
