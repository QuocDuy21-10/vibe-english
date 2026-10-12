import { describe, expect, it } from "vitest";
import {
  analyzeBulkItems,
  parseBulkText,
  parseCsvContent,
  parseCsvRows
} from "@/lib/bulkParser";
import {
  addVocabularySynonym,
  checkDuplicateVocabulary,
  encodeSynonymMapKey,
  findDuplicateVocabulary,
  getVocabularySynonymLabels,
  getVocabularyKey,
  hasSelfSynonym,
  isDuplicateWord,
  normalizeSynonymSelection,
  normalizePartOfSpeech,
  normalizeVocabularyWord
} from "@/lib/vocabulary";
import {
  filterAndSortVocabularies,
  filterVocabularies,
  sortVocabularies
} from "@/lib/vocabularySelectors";
import type { Topic, Vocabulary } from "@/types/types";

describe("vocabulary domain logic", () => {
  describe("normalizeVocabularyWord", () => {
    it("trims leading and trailing whitespace", () => {
      expect(normalizeVocabularyWord("  hello  ")).toBe("hello");
    });

    it("lowercases all characters", () => {
      expect(normalizeVocabularyWord("HELLO WORLD")).toBe("hello world");
      expect(normalizeVocabularyWord("ApPLe")).toBe("apple");
    });

    it("collapses consecutive internal whitespace to a single space", () => {
      expect(normalizeVocabularyWord("look   after")).toBe("look after");
      expect(normalizeVocabularyWord("  take   care   of  ")).toBe("take care of");
    });

    it("handles empty or falsy strings gracefully", () => {
      expect(normalizeVocabularyWord("")).toBe("");
      expect(normalizeVocabularyWord("   ")).toBe("");
    });
  });

  describe("normalizePartOfSpeech", () => {
    it("normalizes standard parts of speech", () => {
      expect(normalizePartOfSpeech("noun")).toBe("noun");
      expect(normalizePartOfSpeech(" VERB ")).toBe("verb");
      expect(normalizePartOfSpeech("Adjective")).toBe("adjective");
    });

    it("maps common abbreviations", () => {
      expect(normalizePartOfSpeech("n")).toBe("noun");
      expect(normalizePartOfSpeech("v")).toBe("verb");
      expect(normalizePartOfSpeech("adj")).toBe("adjective");
      expect(normalizePartOfSpeech("adv")).toBe("adverb");
    });

    it("handles empty or null gracefully", () => {
      expect(normalizePartOfSpeech("")).toBe("");
      expect(normalizePartOfSpeech(null)).toBe("");
      expect(normalizePartOfSpeech(undefined)).toBe("");
    });
  });

  describe("getVocabularyKey", () => {
    it("generates composite key combining word and part of speech", () => {
      expect(getVocabularyKey("trip", "noun")).toBe("trip#noun");
      expect(getVocabularyKey("TRIP", "verb")).toBe("trip#verb");
      expect(getVocabularyKey("  trip  ", "v")).toBe("trip#verb");
      expect(getVocabularyKey("apple")).toBe("apple#");
    });
  });

  describe("duplicate detection", () => {
    const mockVocabs: Vocabulary[] = [
      {
        id: "v1",
        word: "Apple",
        normalizedWord: "apple",
        definition: "Quả táo",
        partOfSpeech: "noun",
        phonetic: "/ˈæp.əl/",
        topicId: "t1",
        userId: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        level: 0,
        nextReview: new Date()
      },
      {
        id: "v2",
        word: "Banana",
        // Legacy item without normalizedWord field
        definition: "Quả chuối",
        partOfSpeech: "noun",
        phonetic: "",
        topicId: null,
        userId: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        level: 1,
        nextReview: new Date()
      },
      {
        id: "v3",
        word: "trip",
        normalizedWord: "trip",
        definition: "Chuyến đi",
        partOfSpeech: "noun",
        phonetic: "/trɪp/",
        topicId: "t1",
        userId: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        level: 0,
        nextReview: new Date()
      }
    ];

    it("detects exact and case/whitespace insensitive duplicates", () => {
      expect(isDuplicateWord("apple", mockVocabs)).toBe(true);
      expect(isDuplicateWord("  APPLE  ", mockVocabs)).toBe(true);
      expect(isDuplicateWord("banana", mockVocabs)).toBe(true);
      expect(isDuplicateWord("  BANANA ", mockVocabs)).toBe(true);
      expect(isDuplicateWord("orange", mockVocabs)).toBe(false);
    });

    it("allows the same word with different parts of speech (e.g. trip [noun] vs trip [verb])", () => {
      // "trip" (noun) exists, but "trip" (verb) should NOT be considered a duplicate
      const resultVerb = checkDuplicateVocabulary("trip", mockVocabs, {
        partOfSpeech: "verb",
        topicId: "t1"
      });
      expect(resultVerb.isDuplicate).toBe(false);
      expect(resultVerb.existingVocab).toBeUndefined();

      // "trip" (noun) in the same topic SHOULD be an exact duplicate
      const resultNoun = checkDuplicateVocabulary("trip", mockVocabs, {
        partOfSpeech: "noun",
        topicId: "t1"
      });
      expect(resultNoun.isDuplicate).toBe(true);
      expect(resultNoun.duplicateType).toBe("exact");
      expect(resultNoun.existingVocab?.id).toBe("v3");
    });

    it("identifies cross-topic duplicates when word and POS match in different topics", () => {
      const result = checkDuplicateVocabulary("trip", mockVocabs, {
        partOfSpeech: "noun",
        topicId: "t2" // Different from v3's topic "t1"
      });
      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateType).toBe("cross_topic");
      expect(result.existingVocab?.id).toBe("v3");
    });

    it("returns the duplicate record when found", () => {
      const result = findDuplicateVocabulary("  APPLE ", mockVocabs);
      expect(result).toBeDefined();
      expect(result?.id).toBe("v1");
      expect(result?.topicId).toBe("t1");
    });

    it("excludes the given vocab ID during edit checks", () => {
      // Editing v1 to "apple" (same word) should NOT trigger duplicate error on itself
      expect(isDuplicateWord("apple", mockVocabs, { excludeVocabId: "v1" })).toBe(false);
      expect(findDuplicateVocabulary("apple", mockVocabs, "v1")).toBeUndefined();

      // Editing v2 to "apple" (clashes with v1) SHOULD trigger duplicate error
      expect(isDuplicateWord("apple", mockVocabs, { excludeVocabId: "v2" })).toBe(true);
    });
  });

  describe("synonym selection", () => {
    const vocabularies: Vocabulary[] = [
      {
        id: "v1",
        word: "Happy",
        normalizedWord: "happy",
        definition: "vui vẻ",
        partOfSpeech: "adjective",
        phonetic: "/ˈhæp.i/",
        topicId: null,
        userId: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        level: 0,
        nextReview: new Date()
      },
      {
        id: "v2",
        word: "Joyful",
        normalizedWord: "joyful",
        definition: "vui sướng",
        partOfSpeech: "adjective",
        phonetic: "/ˈdʒɔɪ.fəl/",
        topicId: null,
        userId: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        level: 0,
        nextReview: new Date()
      }
    ];

    it("links an existing vocabulary by id instead of storing a duplicate custom word", () => {
      const result = addVocabularySynonym(
        "  JOYFUL ",
        { synonymIds: [], customSynonyms: [] },
        vocabularies,
        { currentVocabularyId: "v1", currentWord: "Happy" }
      );

      expect(result.status).toBe("added_existing");
      expect(result.selection).toEqual({
        synonymIds: ["v2"],
        customSynonyms: []
      });
    });

    it("stores a normalized display word when the synonym is not in the vocabulary collection", () => {
      const result = addVocabularySynonym(
        "  in   high spirits  ",
        { synonymIds: [], customSynonyms: [] },
        vocabularies,
        { currentVocabularyId: "v1", currentWord: "Happy" }
      );

      expect(result.status).toBe("added_custom");
      expect(result.selection.customSynonyms).toEqual(["in high spirits"]);
    });

    it("rejects the current word and case-insensitive duplicates across linked and custom synonyms", () => {
      const selection = {
        synonymIds: ["v2"],
        customSynonyms: ["Cheerful"]
      };

      expect(
        addVocabularySynonym("happy", selection, vocabularies, {
          currentVocabularyId: "v1",
          currentWord: "Happy"
        }).status
      ).toBe("self");
      expect(
        addVocabularySynonym("JOYFUL", selection, vocabularies, {
          currentVocabularyId: "v1",
          currentWord: "Happy"
        }).status
      ).toBe("duplicate");
      expect(
        addVocabularySynonym(" cheerful ", selection, vocabularies, {
          currentVocabularyId: "v1",
          currentWord: "Happy"
        }).status
      ).toBe("duplicate");
    });

    it("normalizes persisted selections and resolves readable card labels", () => {
      const normalized = normalizeSynonymSelection({
        synonymIds: [" v2 ", "v2", "", "missing"],
        customSynonyms: [" Cheerful ", "cheerful", "  in   high spirits ", ""]
      });

      expect(normalized).toEqual({
        synonymIds: ["v2", "missing"],
        customSynonyms: ["Cheerful", "in high spirits"]
      });
      expect(
        getVocabularySynonymLabels(
          {
            ...vocabularies[0],
            synonymIds: normalized.synonymIds,
            customSynonyms: normalized.customSynonyms
          },
          vocabularies
        )
      ).toEqual(["Joyful", "Cheerful", "in high spirits"]);
    });

    it("detects self-synonyms after the main word changes", () => {
      expect(
        hasSelfSynonym(
          "joyful",
          { synonymIds: ["v2"], customSynonyms: [] },
          vocabularies
        )
      ).toBe(true);
      expect(
        hasSelfSynonym(
          "cheerful",
          { synonymIds: [], customSynonyms: [" Cheerful "] },
          vocabularies
        )
      ).toBe(true);
      expect(
        hasSelfSynonym(
          "happy",
          { synonymIds: ["v2"], customSynonyms: ["Cheerful"] },
          vocabularies
        )
      ).toBe(false);
    });

    it("defensively ignores malformed persisted synonym values", () => {
      const malformedSelection: { synonymIds?: unknown; customSynonyms?: unknown } = {
        synonymIds: ["v2", 123, null],
        customSynonyms: ["Cheerful", { word: "glad" }, false]
      };

      expect(normalizeSynonymSelection(malformedSelection)).toEqual({
        synonymIds: ["v2"],
        customSynonyms: ["Cheerful"]
      });

      expect(
        normalizeSynonymSelection({
          synonymIds: { [encodeSynonymMapKey("__linked__")]: "__linked__" },
          customSynonyms: {
            [encodeSynonymMapKey("in high spirits")]: "in high spirits"
          }
        })
      ).toEqual({
        synonymIds: ["__linked__"],
        customSynonyms: ["in high spirits"]
      });

      expect(
        normalizeSynonymSelection({ customSynonyms: { value_happy: true } })
      ).toEqual({
        synonymIds: [],
        customSynonyms: ["value_happy"]
      });
    });

    it("refuses to add more than 10 synonyms", () => {
      const result = addVocabularySynonym(
        "another synonym",
        {
          synonymIds: [],
          customSynonyms: Array.from({ length: 10 }, (_, index) => `synonym ${index}`)
        },
        vocabularies
      );

      expect(result.status).toBe("limit");
      expect(result.selection.customSynonyms).toHaveLength(10);
    });
  });

  describe("bulk text parser", () => {
    it("parses single words per line", () => {
      const text = `apple\nbanana\norange`;
      const result = parseBulkText(text);
      expect(result).toHaveLength(3);
      expect(result[0].word).toBe("apple");
      expect(result[1].word).toBe("banana");
      expect(result[2].word).toBe("orange");
    });

    it("parses pipe delimited rows with optional fields", () => {
      const text = `apple | quả táo | noun | /ˈæp.əl/\nbanana | quả chuối`;
      const result = parseBulkText(text, "default-topic");
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        word: "apple",
        definition: "quả táo",
        partOfSpeech: "noun",
        phonetic: "/ˈæp.əl/",
        topicId: "default-topic"
      });
      expect(result[1]).toMatchObject({
        word: "banana",
        definition: "quả chuối",
        partOfSpeech: "",
        phonetic: "",
        topicId: "default-topic"
      });
    });

    it("handles empty lines and whitespace appropriately", () => {
      const text = `\n  \napple\n\nbanana\n   `;
      const result = parseBulkText(text);
      expect(result).toHaveLength(2);
      expect(result[0].word).toBe("apple");
      expect(result[1].word).toBe("banana");
    });
  });

  describe("CSV parser", () => {
    it("parses standard CSV rows and strips BOM", () => {
      const csv = `\uFEFFword,definition,partOfSpeech,phonetic,topic\napple,quả táo,noun,/ˈæp.əl/,Food\nbanana,quả chuối,noun,/bəˈnæn.ə/,Food`;
      const mockTopics: Topic[] = [
        { id: "t-food", name: "Food", userId: "u1", createdAt: new Date() }
      ];

      const result = parseCsvContent(csv, mockTopics);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        word: "apple",
        definition: "quả táo",
        partOfSpeech: "noun",
        phonetic: "/ˈæp.əl/",
        topicId: "t-food"
      });
      expect(result[1]).toMatchObject({
        word: "banana",
        definition: "quả chuối",
        topicId: "t-food"
      });
    });

    it("handles quoted fields with commas and escaped quotes", () => {
      const csv = `"word","definition"\n"apple, red","táo, màu đỏ"\n"quote ""test""","thử nghiệm"`;
      const rows = parseCsvRows(csv);
      expect(rows).toHaveLength(3);
      expect(rows[1][0]).toBe("apple, red");
      expect(rows[1][1]).toBe("táo, màu đỏ");
      expect(rows[2][0]).toBe('quote "test"');
      expect(rows[2][1]).toBe("thử nghiệm");
    });

    it("maps topic names case-insensitively to existing topics", () => {
      const csv = `word,topic\napple,technology\nbanana,unknown`;
      const mockTopics: Topic[] = [
        { id: "t-tech", name: "Technology", userId: "u1", createdAt: new Date() }
      ];

      const result = parseCsvContent(csv, mockTopics, "default-topic");
      expect(result[0].topicId).toBe("t-tech");
      expect(result[1].topicId).toBe("default-topic");
    });
  });

  describe("analyzeBulkItems", () => {
    const existing: Vocabulary[] = [
      {
        id: "v1",
        word: "apple",
        definition: "quả táo",
        partOfSpeech: "noun",
        phonetic: "",
        topicId: null,
        userId: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        level: 0,
        nextReview: null
      }
    ];

    it("categorizes valid rows, duplicate in file, duplicate in db, and invalid rows", () => {
      const items = [
        { rawId: "1", word: "banana", definition: "quả chuối" },
        { rawId: "2", word: "BANANA", definition: "lặp lại" },
        { rawId: "3", word: "apple", definition: "đã có trong db" },
        { rawId: "4", word: "", definition: "thiếu từ" }
      ];

      const { rows, summary } = analyzeBulkItems(items, existing);

      expect(summary.total).toBe(4);
      expect(summary.valid).toBe(1);
      expect(summary.duplicateInFile).toBe(1);
      expect(summary.duplicateInDb).toBe(1);
      expect(summary.invalid).toBe(1);

      expect(rows[0].status).toBe("valid");
      expect(rows[1].status).toBe("duplicate_in_file");
      expect(rows[2].status).toBe("duplicate_in_db");
      expect(rows[3].status).toBe("invalid");
    });
  });

  describe("filterAndSortVocabularies", () => {
    const testVocabs: Vocabulary[] = [
      {
        id: "v1",
        word: "Cat",
        definition: "Con mèo",
        partOfSpeech: "noun",
        phonetic: "/kæt/",
        topicId: "animals",
        userId: "u1",
        createdAt: new Date("2026-08-01T10:00:00Z"),
        updatedAt: new Date("2026-08-01T10:00:00Z"),
        level: 0,
        nextReview: new Date("2026-08-01T10:00:00Z")
      },
      {
        id: "v2",
        word: "Dog",
        definition: "Con chó",
        partOfSpeech: "noun",
        phonetic: "/dɒɡ/",
        topicId: "animals",
        userId: "u1",
        createdAt: new Date("2026-08-02T10:00:00Z"),
        updatedAt: new Date("2026-08-02T10:00:00Z"),
        level: 2,
        nextReview: new Date("2026-08-10T10:00:00Z")
      },
      {
        id: "v3",
        word: "Apple",
        definition: "Quả táo",
        partOfSpeech: "noun",
        phonetic: "/ˈæp.əl/",
        topicId: null,
        userId: "u1",
        createdAt: new Date("2026-08-03T10:00:00Z"),
        updatedAt: new Date("2026-08-03T10:00:00Z"),
        level: 4,
        nextReview: new Date("2026-09-01T10:00:00Z")
      }
    ];

    it("filters by search query matching word or definition", () => {
      const resWord = filterVocabularies(testVocabs, "dog", "all");
      expect(resWord).toHaveLength(1);
      expect(resWord[0].word).toBe("Dog");

      const resDef = filterVocabularies(testVocabs, "mèo", "all");
      expect(resDef).toHaveLength(1);
      expect(resDef[0].word).toBe("Cat");
    });

    it("filters by topic and unassigned filter", () => {
      const animals = filterVocabularies(testVocabs, "", "animals");
      expect(animals).toHaveLength(2);

      const unassigned = filterVocabularies(testVocabs, "", "none");
      expect(unassigned).toHaveLength(1);
      expect(unassigned[0].word).toBe("Apple");
    });

    it("sorts by alphabetical A-Z and Z-A", () => {
      const az = sortVocabularies(testVocabs, "alpha-asc");
      expect(az.map((v) => v.word)).toEqual(["Apple", "Cat", "Dog"]);

      const za = sortVocabularies(testVocabs, "alpha-desc");
      expect(za.map((v) => v.word)).toEqual(["Dog", "Cat", "Apple"]);
    });

    it("sorts by newest and oldest", () => {
      const newest = sortVocabularies(testVocabs, "newest");
      expect(newest[0].word).toBe("Apple");

      const oldest = sortVocabularies(testVocabs, "oldest");
      expect(oldest[0].word).toBe("Cat");
    });

    it("filters by status (new, learning, mastered, due)", () => {
      const now = new Date("2026-08-05T00:00:00Z");

      const newOnly = filterAndSortVocabularies(testVocabs, { statusFilter: "new" });
      expect(newOnly).toHaveLength(1);
      expect(newOnly[0].word).toBe("Cat");

      const learningOnly = filterAndSortVocabularies(testVocabs, { statusFilter: "learning" });
      expect(learningOnly).toHaveLength(1);
      expect(learningOnly[0].word).toBe("Dog");

      const masteredOnly = filterAndSortVocabularies(testVocabs, { statusFilter: "mastered" });
      expect(masteredOnly).toHaveLength(1);
      expect(masteredOnly[0].word).toBe("Apple");

      const dueOnly = filterAndSortVocabularies(testVocabs, { statusFilter: "due", now });
      expect(dueOnly).toHaveLength(1);
      expect(dueOnly[0].word).toBe("Cat");
    });
  });
});
