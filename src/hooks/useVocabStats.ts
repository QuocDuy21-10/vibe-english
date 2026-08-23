import { useMemo } from "react";

import {
  countVocabulariesByTopic,
  filterAndSortVocabularies,
  filterVocabularies,
  getVocabularyOverview,
  sortTopicsByName,
  type FilterAndSortOptions
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

export function useFilteredAndSortedVocabularies(
  vocabularies: Vocabulary[],
  options: FilterAndSortOptions
) {
  const { searchQuery, selectedTopicId, statusFilter, sortOption } = options;
  return useMemo(
    () => filterAndSortVocabularies(vocabularies, options),
    [vocabularies, searchQuery, selectedTopicId, statusFilter, sortOption]
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
