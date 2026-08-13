import { useMemo } from "react";

import {
  countVocabulariesByTopic,
  filterVocabularies,
  getVocabularyOverview,
  sortTopicsByName
} from "@/lib/vocabularySelectors";
import type { Topic, Vocabulary } from "@/types/types";

export function useFilteredVocabularies(
  vocabularies: Vocabulary[],
  searchQuery: string,
  selectedTopicId: string
) {
  return useMemo(
    () => filterVocabularies(vocabularies, searchQuery, selectedTopicId),
    [vocabularies, searchQuery, selectedTopicId]
  );
}

export function useVocabularyOverview(vocabularies: Vocabulary[]) {
  return useMemo(() => getVocabularyOverview(vocabularies), [vocabularies]);
}

export function useTopicVocabularyCounts(vocabularies: Vocabulary[]) {
  return useMemo(() => countVocabulariesByTopic(vocabularies), [vocabularies]);
}

export function useSortedTopics(topics: Topic[]) {
  return useMemo(() => sortTopicsByName(topics), [topics]);
}
