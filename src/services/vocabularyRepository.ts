import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import {
  encodeSynonymMapKey,
  normalizeSynonymSelection,
  normalizeVocabularyWord
} from "@/lib/vocabulary";
import {
  DEFAULT_EASE_FACTOR,
  SRS_VERSION,
  deriveLevel,
  normalizeSchedule,
  type FlashcardRating,
  type ScheduleUpdate
} from "@/lib/srs";
import { OperationType, type BatchCreateResult, type Vocabulary } from "@/types/types";

export type RecordVocabularyReviewInput = {
  vocabulary: Vocabulary;
  schedule: ScheduleUpdate;
  rating: FlashcardRating;
  userId: string;
};


export type CreateVocabularyInput = {
  word: string;
  definition: string;
  partOfSpeech?: string | null;
  phonetic?: string | null;
  topicId?: string | null;
  synonymIds?: string[];
  customSynonyms?: string[];
};

export type UpdateVocabularyInput = {
  word: string;
  definition: string;
  partOfSpeech?: string | null;
  phonetic?: string | null;
  topicId?: string | null;
  synonymIds?: string[];
  customSynonyms?: string[];
};

function toPersistedSynonymMap(values: string[]): Record<string, string> {
  return Object.fromEntries(values.map((value) => [encodeSynonymMapKey(value), value]));
}

export async function createVocabulary(
  userId: string,
  input: CreateVocabularyInput
): Promise<string> {
  const synonyms = normalizeSynonymSelection(input);
  const normalized = {
    word: input.word.trim(),
    normalizedWord: normalizeVocabularyWord(input.word),
    definition: input.definition.trim(),
    partOfSpeech: input.partOfSpeech?.trim() ?? "",
    phonetic: input.phonetic?.trim() ?? "",
    topicId: input.topicId?.trim() || null,
    ...synonyms
  };

  try {
    const docRef = await addDoc(collection(db, "vocabularies"), {
      word: normalized.word,
      normalizedWord: normalized.normalizedWord,
      definition: normalized.definition,
      partOfSpeech: normalized.partOfSpeech,
      phonetic: normalized.phonetic,
      topicId: normalized.topicId,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      level: 0,
      nextReview: serverTimestamp(),
      srsVersion: SRS_VERSION,
      intervalDays: 0,
      easeFactor: DEFAULT_EASE_FACTOR,
      repetitions: 0,
      lapses: 0,
      lastReviewedAt: null,
      synonymIds: toPersistedSynonymMap(normalized.synonymIds),
      customSynonyms: toPersistedSynonymMap(normalized.customSynonyms)
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "vocabularies");
    throw error;
  }
}

export async function updateVocabulary(
  id: string,
  input: UpdateVocabularyInput
): Promise<void> {
  const synonyms = normalizeSynonymSelection(input);
  const normalized = {
    word: input.word.trim(),
    normalizedWord: normalizeVocabularyWord(input.word),
    definition: input.definition.trim(),
    partOfSpeech: input.partOfSpeech?.trim() ?? "",
    phonetic: input.phonetic?.trim() ?? "",
    topicId: input.topicId?.trim() || null,
    ...synonyms
  };

  try {
    await updateDoc(doc(db, "vocabularies", id), {
      word: normalized.word,
      normalizedWord: normalized.normalizedWord,
      definition: normalized.definition,
      partOfSpeech: normalized.partOfSpeech,
      phonetic: normalized.phonetic,
      topicId: normalized.topicId,
      synonymIds: toPersistedSynonymMap(normalized.synonymIds),
      customSynonyms: toPersistedSynonymMap(normalized.customSynonyms),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vocabularies/${id}`);
    throw error;
  }
}

/**
 * Creates multiple vocabularies using Firestore writeBatch in chunks (up to 200 items/batch).
 */
export async function batchCreateVocabularies(
  userId: string,
  items: CreateVocabularyInput[]
): Promise<BatchCreateResult> {
  if (!items || items.length === 0) {
    return { totalCount: 0, successCount: 0, failedCount: 0 };
  }

  const CHUNK_SIZE = 200;
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((item) => {
      const vocabRef = doc(collection(db, "vocabularies"));
      const word = item.word.trim();
      const normalizedWord = normalizeVocabularyWord(word);
      const definition = item.definition.trim();
      const partOfSpeech = item.partOfSpeech?.trim() ?? "";
      const phonetic = item.phonetic?.trim() ?? "";
      const topicId = item.topicId?.trim() || null;
      const synonyms = normalizeSynonymSelection(item);

      batch.set(vocabRef, {
        word,
        normalizedWord,
        definition,
        partOfSpeech,
        phonetic,
        topicId,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        level: 0,
        nextReview: serverTimestamp(),
        srsVersion: SRS_VERSION,
        intervalDays: 0,
        easeFactor: DEFAULT_EASE_FACTOR,
        repetitions: 0,
        lapses: 0,
        lastReviewedAt: null,
        synonymIds: toPersistedSynonymMap(synonyms.synonymIds),
        customSynonyms: toPersistedSynonymMap(synonyms.customSynonyms)
      });
    });

    try {
      await batch.commit();
      successCount += chunk.length;
    } catch (error) {
      failedCount += chunk.length;
      handleFirestoreError(error, OperationType.WRITE, "vocabularies/batch");
      throw error;
    }
  }

  return {
    totalCount: items.length,
    successCount,
    failedCount
  };
}

export async function deleteVocabulary(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "vocabularies", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `vocabularies/${id}`);
    throw error;
  }
}

export async function recordVocabularyReview(
  input: RecordVocabularyReviewInput
): Promise<void> {
  const { vocabulary, schedule, rating, userId } = input;
  const previousSchedule = normalizeSchedule(vocabulary);
  const previousLevel = deriveLevel(previousSchedule);

  try {
    const batch = writeBatch(db);
    const vocabRef = doc(db, "vocabularies", vocabulary.id);
    const eventRef = doc(collection(db, "reviewEvents"));

    batch.update(vocabRef, {
      srsVersion: schedule.srsVersion,
      intervalDays: schedule.intervalDays,
      easeFactor: schedule.easeFactor,
      repetitions: schedule.repetitions,
      lapses: schedule.lapses,
      level: schedule.level,
      nextReview: schedule.nextReview,
      lastReviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    batch.set(eventRef, {
      userId,
      vocabularyId: vocabulary.id,
      rating,
      previousLevel,
      newLevel: schedule.level,
      previousIntervalDays: previousSchedule.intervalDays,
      newIntervalDays: schedule.intervalDays,
      topicId: vocabulary.topicId ?? null,
      srsVersion: schedule.srsVersion,
      reviewedAt: serverTimestamp()
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `vocabularies/${vocabulary.id}/reviewEvents`);
    throw error;
  }
}

export async function updateVocabularyReview(
  id: string,
  schedule: ScheduleUpdate
): Promise<void> {
  try {
    await updateDoc(doc(db, "vocabularies", id), {
      srsVersion: schedule.srsVersion,
      intervalDays: schedule.intervalDays,
      easeFactor: schedule.easeFactor,
      repetitions: schedule.repetitions,
      lapses: schedule.lapses,
      level: schedule.level,
      nextReview: schedule.nextReview,
      lastReviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vocabularies/${id}`);
    throw error;
  }
}


export function subscribeVocabularies(
  userId: string,
  onNext: (vocabularies: Vocabulary[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const vocabQuery = query(
    collection(db, "vocabularies"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    vocabQuery,
    (snapshot) => {
      const vocabularies = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          ...data,
          ...normalizeSynonymSelection(data)
        } as Vocabulary;
      });
      onNext(vocabularies);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, "vocabularies");
      if (onError) {
        onError(error);
      }
    }
  );
}
