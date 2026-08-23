import { describe, expect, it } from "vitest";

import { DEFAULT_TOPIC_FILTER, UNASSIGNED_TOPIC_FILTER } from "@/constants/vocab";
import {
  countVocabulariesByTopic,
  filterVocabularies,
  getDueCount,
  getDueVocabularies,
  getVocabularyOverview,
  sortTopicsByName
} from "@/lib/vocabularySelectors";
import type { Topic, Vocabulary } from "@/types/types";


const NOW = new Date("2026-08-13T00:00:00.000Z");

function vocabulary(id: string, overrides: Partial<Vocabulary> = {}): Vocabulary {
  return {
    id,
    word: `word-${id}`,
    definition: `nghĩa-${id}`,
    partOfSpeech: "noun",
    phonetic: "",
    topicId: "topic-a",
    userId: "user",
    createdAt: NOW,
    updatedAt: NOW,
    level: 0,
    nextReview: NOW,
    ...overrides
  };
}

describe("filterVocabularies", () => {
  const items = [
    vocabulary("one", { word: "Travel", definition: "du lịch" }),
    vocabulary("two", { word: "Run", partOfSpeech: "verb", topicId: null })
  ];

  it("filters across word, definition and part of speech", () => {
    expect(filterVocabularies(items, "DU LỊCH", DEFAULT_TOPIC_FILTER)).toEqual([items[0]]);
    expect(filterVocabularies(items, "verb", DEFAULT_TOPIC_FILTER)).toEqual([items[1]]);
  });

  it("supports assigned and unassigned topic filters", () => {
    expect(filterVocabularies(items, "", "topic-a")).toEqual([items[0]]);
    expect(filterVocabularies(items, "", UNASSIGNED_TOPIC_FILTER)).toEqual([items[1]]);
  });
});

describe("getVocabularyOverview", () => {
  it("calculates level counts and mastery in one result", () => {
    const result = getVocabularyOverview([
      vocabulary("new"),
      vocabulary("mastered", { level: 4 })
    ]);

    expect(result.levelCounts).toEqual([1, 0, 0, 0, 1]);
    expect(result.stats).toMatchObject({ totalVocab: 2, learnedVocab: 1, progress: 50 });
  });
});

describe("topic selectors", () => {
  it("counts only vocabularies with a topic", () => {
    const counts = countVocabulariesByTopic([
      vocabulary("one"),
      vocabulary("two"),
      vocabulary("three", { topicId: null })
    ]);

    expect(counts.get("topic-a")).toBe(2);
    expect(counts.size).toBe(1);
  });

  it("sorts topics without mutating the source array", () => {
    const topics: Topic[] = [
      { id: "b", name: "Work", userId: "user", createdAt: NOW },
      { id: "a", name: "Travel", userId: "user", createdAt: NOW }
    ];

    expect(sortTopicsByName(topics).map((topic) => topic.name)).toEqual(["Travel", "Work"]);
    expect(topics.map((topic) => topic.name)).toEqual(["Work", "Travel"]);
  });
});

describe("due vocabulary selectors", () => {
  it("filters vocabularies that are due for review", () => {
    const dueItem = vocabulary("due", { nextReview: new Date("2026-08-12T00:00:00Z") });
    const futureItem = vocabulary("future", { nextReview: new Date("2026-08-14T00:00:00Z") });
    const nullDateItem = vocabulary("null-date", { nextReview: null });

    const items = [dueItem, futureItem, nullDateItem];
    const due = getDueVocabularies(items, NOW);

    expect(due.map((i) => i.id)).toEqual(["due", "null-date"]);
    expect(getDueCount(items, NOW)).toBe(2);
  });
});
