import { PART_OF_SPEECH_OPTIONS } from "@/constants/vocab";
import type { Vocabulary } from "@/types/types";

/**
 * Pure normalization helper for English vocabulary words.
 * Trims whitespace, lowercases, and collapses accidental repeated spaces.
 */
export function normalizeVocabularyWord(word: string): string {
  if (!word) return "";
  return word
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Normalizes part-of-speech strings.
 * Handles common abbreviations (e.g. 'n' -> 'noun', 'v' -> 'verb', 'adj' -> 'adjective', 'adv' -> 'adverb')
 * and returns standard lowercase representation.
 */
export function normalizePartOfSpeech(pos?: string | null): string {
  if (!pos) return "";
  const clean = pos.trim().toLowerCase();
  if ((PART_OF_SPEECH_OPTIONS as readonly string[]).includes(clean)) {
    return clean;
  }
  if (clean === "n" || clean === "n.") return "noun";
  if (clean === "v" || clean === "v.") return "verb";
  if (clean === "adj" || clean === "adj.") return "adjective";
  if (clean === "adv" || clean === "adv.") return "adverb";
  if (clean === "prep" || clean === "prep.") return "prep";
  if (clean === "conj" || clean === "conj.") return "conj";
  return clean;
}

/**
 * Returns a composite key for vocabulary duplicate detection.
 * Format: "normalizedWord#normalizedPos"
 */
export function getVocabularyKey(word: string, partOfSpeech?: string | null): string {
  const normWord = normalizeVocabularyWord(word);
  if (!normWord) return "";
  const normPos = normalizePartOfSpeech(partOfSpeech);
  return `${normWord}#${normPos}`;
}

export type DuplicateType = "exact" | "cross_topic";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: DuplicateType;
  existingVocab?: Vocabulary;
}

export interface DuplicateCheckOptions {
  partOfSpeech?: string | null;
  topicId?: string | null;
  excludeVocabId?: string;
}

/**
 * Checks whether a word + part of speech already exists in the vocabulary list.
 *
 * Rules:
 * 1. If partOfSpeech is provided:
 *    - Different parts of speech (e.g. "trip" noun vs "trip" verb) NEVER conflict.
 *    - Only matches items that have the same part of speech (or items with no part of speech).
 * 2. If partOfSpeech is empty/omitted:
 *    - Matches any existing item with the same word.
 * 3. Topic distinction:
 *    - If matched item is in the same topic -> "exact" duplicate.
 *    - If matched item is in another topic -> "cross_topic" duplicate.
 */
export function checkDuplicateVocabulary(
  word: string,
  existingVocabularies: Vocabulary[],
  options?: DuplicateCheckOptions
): DuplicateCheckResult {
  const normWord = normalizeVocabularyWord(word);
  if (!normWord) {
    return { isDuplicate: false };
  }

  const normPos = normalizePartOfSpeech(options?.partOfSpeech);
  const targetTopicId = options?.topicId?.trim() || null;
  const excludeVocabId = options?.excludeVocabId;

  const matched = existingVocabularies.find((v) => {
    if (excludeVocabId && v.id === excludeVocabId) {
      return false;
    }
    const itemNormWord = v.normalizedWord || normalizeVocabularyWord(v.word);
    if (itemNormWord !== normWord) {
      return false;
    }

    const itemNormPos = normalizePartOfSpeech(v.partOfSpeech);

    // If candidate has a specific POS:
    if (normPos) {
      if (itemNormPos) {
        return itemNormPos === normPos;
      }
      // Existing item has no POS -> potential match
      return true;
    }

    // If candidate has NO POS specified, matches any existing item with the same word
    return true;
  });

  if (!matched) {
    return { isDuplicate: false };
  }

  const matchedTopicId = matched.topicId || null;
  const isSameTopic = matchedTopicId === targetTopicId;

  return {
    isDuplicate: true,
    duplicateType: isSameTopic ? "exact" : "cross_topic",
    existingVocab: matched
  };
}

/**
 * Checks if a word already exists in the given vocabulary list.
 * Backward-compatible helper that supports passing options object or excludeVocabId string.
 */
export function findDuplicateVocabulary(
  word: string,
  existingVocabularies: Vocabulary[],
  optionsOrExcludeId?: DuplicateCheckOptions | string
): Vocabulary | undefined {
  const options: DuplicateCheckOptions =
    typeof optionsOrExcludeId === "string"
      ? { excludeVocabId: optionsOrExcludeId }
      : (optionsOrExcludeId ?? {});

  const result = checkDuplicateVocabulary(word, existingVocabularies, options);
  return result.existingVocab;
}

/**
 * Boolean duplicate check helper.
 */
export function isDuplicateWord(
  word: string,
  existingVocabularies: Vocabulary[],
  optionsOrExcludeId?: DuplicateCheckOptions | string
): boolean {
  const options: DuplicateCheckOptions =
    typeof optionsOrExcludeId === "string"
      ? { excludeVocabId: optionsOrExcludeId }
      : (optionsOrExcludeId ?? {});

  return checkDuplicateVocabulary(word, existingVocabularies, options).isDuplicate;
}
