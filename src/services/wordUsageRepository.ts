import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { getWordUsages, type WordUsageRequestItem } from "@/services/geminiService";
import {
  OperationType,
  type Vocabulary,
  type WordUsage,
  type WordUsageContent
} from "@/types/types";

// Mirrors the list limits enforced by firestore.rules for wordUsages.
const MAX_EXAMPLES = 5;
const MAX_COLLOCATIONS = 8;

export type SaveWordUsageInput = {
  vocabulary: Vocabulary;
  userId: string;
  content: WordUsageContent;
};

function sanitizeContent(content: WordUsageContent): WordUsageContent {
  return {
    examples: content.examples.slice(0, MAX_EXAMPLES).map((example) => ({
      sentence: example.sentence.trim().slice(0, 300),
      translation: example.translation.trim().slice(0, 300),
      answer: example.answer.trim().slice(0, 100)
    })),
    collocations: content.collocations.slice(0, MAX_COLLOCATIONS).map((collocation) => ({
      phrase: collocation.phrase.trim().slice(0, 100),
      meaning: collocation.meaning.trim().slice(0, 200)
    }))
  };
}

export async function getWordUsage(vocabularyId: string): Promise<WordUsage | null> {
  const path = `wordUsages/${vocabularyId}`;
  try {
    const snapshot = await getDoc(doc(db, "wordUsages", vocabularyId));
    if (!snapshot.exists()) return null;
    // Shape is guaranteed by firestore.rules on every write.
    return snapshot.data() as WordUsage;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function saveWordUsage({ vocabulary, userId, content }: SaveWordUsageInput): Promise<WordUsage> {
  const path = `wordUsages/${vocabulary.id}`;
  const base = {
    userId,
    vocabularyId: vocabulary.id,
    word: vocabulary.word.trim(),
    ...sanitizeContent(content)
  };

  try {
    await setDoc(doc(db, "wordUsages", vocabulary.id), { ...base, generatedAt: serverTimestamp() });
    return { ...base, generatedAt: new Date() };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export function isWordUsageStale(usage: WordUsage, vocabulary: Vocabulary): boolean {
  return usage.word.trim() !== vocabulary.word.trim();
}

export function toWordUsageRequestItem(vocabulary: Vocabulary): WordUsageRequestItem {
  return {
    word: vocabulary.word.trim(),
    partOfSpeech: (vocabulary.partOfSpeech ?? "").trim(),
    definition: vocabulary.definition.trim()
  };
}

/** Generates and caches usages for ≤10 vocabularies (one AI request); results follow input order. */
export async function generateWordUsages(vocabularies: Vocabulary[], userId: string): Promise<WordUsage[]> {
  const generated = await getWordUsages(vocabularies.map(toWordUsageRequestItem));
  return Promise.all(
    vocabularies.map((vocabulary, index) =>
      saveWordUsage({
        vocabulary,
        userId,
        content: {
          examples: (generated[index]?.examples ?? []).map((example) => ({
            sentence: example.sentence ?? "",
            translation: example.translation ?? "",
            answer: example.answer ?? ""
          })),
          collocations: (generated[index]?.collocations ?? []).map((collocation) => ({
            phrase: collocation.phrase ?? "",
            meaning: collocation.meaning ?? ""
          }))
        }
      })
    )
  );
}
