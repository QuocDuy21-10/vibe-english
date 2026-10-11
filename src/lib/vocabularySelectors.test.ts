import { describe, expect, it } from "vitest";

import { DEFAULT_TOPIC_FILTER, UNASSIGNED_TOPIC_FILTER } from "@/constants/vocab";
import {
  countVocabulariesByTopic,
  filterAndSortVocabularies,
  filterVocabularies,
  getDueCount,
  getDueVocabularies,
  getVocabularyOverview,
  sortTopicsByName,
  sortTopicsByNewest,
  type VocabularySearchOptions
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

  const matchingItems = [
    vocabulary("upper", { word: "Apple", definition: "quả táo" }),
    vocabulary("lower", { word: "apple", definition: "trái táo" }),
    vocabulary("compound", { word: "pineapple", definition: "quả dứa" }),
    vocabulary("phrase", { word: "apple pie", definition: "bánh táo" })
  ];

  const matchingCases: Array<{
    name: string;
    options?: VocabularySearchOptions;
    expected: string[];
  }> = [
    {
      name: "contains text without case sensitivity by default",
      options: undefined,
      expected: ["Apple", "apple", "pineapple", "apple pie"]
    },
    {
      name: "matches complete fields without case sensitivity",
      options: { searchMode: "exact" },
      expected: ["Apple", "apple"]
    },
    {
      name: "contains text with case sensitivity",
      options: { caseSensitive: true },
      expected: ["apple", "pineapple", "apple pie"]
    },
    {
      name: "matches complete fields with case sensitivity",
      options: { searchMode: "exact", caseSensitive: true },
      expected: ["apple"]
    }
  ];

  it.each(matchingCases)("$name", ({ options, expected }) => {
    expect(
      filterVocabularies(matchingItems, "apple", DEFAULT_TOPIC_FILTER, options).map(
        ({ word }) => word
      )
    ).toEqual(expected);
  });

  it("treats a whitespace-only query as inactive in every mode", () => {
    expect(
      filterVocabularies(matchingItems, "   ", DEFAULT_TOPIC_FILTER, {
        searchMode: "exact",
        caseSensitive: true
      })
    ).toEqual(matchingItems);
  });

  it("trims outer whitespace without collapsing internal whitespace", () => {
    expect(
      filterVocabularies(matchingItems, "  apple  ", DEFAULT_TOPIC_FILTER, {
        searchMode: "exact",
        caseSensitive: true
      }).map(({ word }) => word)
    ).toEqual(["apple"]);
    expect(
      filterVocabularies(matchingItems, "apple  pie", DEFAULT_TOPIC_FILTER, {
        searchMode: "exact"
      })
    ).toEqual([]);
  });

  it("normalizes canonically equivalent Unicode without removing diacritics", () => {
    const accented = vocabulary("accented", { word: "Từ" });

    expect(
      filterVocabularies([accented], "Tu\u031B\u0300", DEFAULT_TOPIC_FILTER, {
        searchMode: "exact"
      })
    ).toEqual([accented]);
    expect(
      filterVocabularies([accented], "Tu", DEFAULT_TOPIC_FILTER, {
        searchMode: "exact"
      })
    ).toEqual([]);
  });

  it("applies exact matching to every existing searchable field", () => {
    const travel = vocabulary("travel", {
      word: "Travel",
      definition: "du lịch",
      partOfSpeech: "noun",
      phonetic: "/ˈtræv.əl/"
    });

    ["Travel", "du lịch", "noun", "/ˈtræv.əl/"].forEach((query) => {
      expect(
        filterVocabularies([travel], query, DEFAULT_TOPIC_FILTER, {
          searchMode: "exact",
          caseSensitive: true
        })
      ).toEqual([travel]);
    });
    expect(
      filterVocabularies([travel], "du", DEFAULT_TOPIC_FILTER, {
        searchMode: "exact"
      })
    ).toEqual([]);
  });

  it("combines exact and case-sensitive matching with topic filters", () => {
    const assigned = vocabulary("assigned", { word: "apple", topicId: "topic-a" });
    const unassigned = vocabulary("unassigned", { word: "apple", topicId: null });
    const searchOptions: VocabularySearchOptions = {
      searchMode: "exact",
      caseSensitive: true
    };

    expect(filterVocabularies([assigned, unassigned], "apple", "topic-a", searchOptions)).toEqual([
      assigned
    ]);
    expect(
      filterVocabularies(
        [assigned, unassigned],
        "apple",
        UNASSIGNED_TOPIC_FILTER,
        searchOptions
      )
    ).toEqual([unassigned]);
  });

  it("forwards search options through filterAndSortVocabularies", () => {
    expect(
      filterAndSortVocabularies(matchingItems, {
        searchQuery: "apple",
        searchMode: "exact",
        caseSensitive: true,
        sortOption: "alpha-asc"
      }).map(({ word }) => word)
    ).toEqual(["apple"]);
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

  it("sorts topics by newest createdAt first, handling pending createdAt and equal dates", () => {
    const older = new Date("2026-08-01T00:00:00.000Z");
    const newer = new Date("2026-08-10T00:00:00.000Z");

    const topics: Topic[] = [
      { id: "1", name: "Old Topic", userId: "user", createdAt: older },
      { id: "2", name: "New Topic", userId: "user", createdAt: newer },
      { id: "3", name: "Brand New Topic (Pending)", userId: "user", createdAt: null as any },
      { id: "4", name: "A Same Date", userId: "user", createdAt: newer },
      { id: "5", name: "B Same Date", userId: "user", createdAt: newer }
    ];

    const sorted = sortTopicsByNewest(topics);
    expect(sorted.map((t) => t.name)).toEqual([
      "Brand New Topic (Pending)",
      "A Same Date",
      "B Same Date",
      "New Topic",
      "Old Topic"
    ]);
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
