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
 * Checks if a word already exists in the given vocabulary list.
 * Safely handles legacy records that might not have `normalizedWord` stored.
 *
 * @param word The word string to test
 * @param existingVocabularies Current list of vocabularies
 * @param excludeVocabId Optional vocabulary ID to exclude (used during edit)
 */
export function findDuplicateVocabulary(
  word: string,
  existingVocabularies: Vocabulary[],
  excludeVocabId?: string
): Vocabulary | undefined {
  const normalized = normalizeVocabularyWord(word);
  if (!normalized) return undefined;

  return existingVocabularies.find((v) => {
    if (excludeVocabId && v.id === excludeVocabId) {
      return false;
    }
    const itemNormalized = v.normalizedWord || normalizeVocabularyWord(v.word);
    return itemNormalized === normalized;
  });
}

/**
 * Boolean duplicate check helper.
 */
export function isDuplicateWord(
  word: string,
  existingVocabularies: Vocabulary[],
  excludeVocabId?: string
): boolean {
  return !!findDuplicateVocabulary(word, existingVocabularies, excludeVocabId);
}
