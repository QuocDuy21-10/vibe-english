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
  DEFAULT_EASE_FACTOR,
  SRS_VERSION,
  deriveLevel,
  normalizeSchedule,
  type FlashcardRating,
  type ScheduleUpdate
} from "@/lib/srs";
import { OperationType, type Vocabulary } from "@/types/types";

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
};

export type UpdateVocabularyInput = {
  word: string;
  definition: string;
  partOfSpeech?: string | null;
  phonetic?: string | null;
  topicId?: string | null;
};

export async function createVocabulary(
  userId: string,
  input: CreateVocabularyInput
): Promise<string> {
  const normalized = {
    word: input.word.trim(),
    definition: input.definition.trim(),
    partOfSpeech: input.partOfSpeech?.trim() ?? "",
    phonetic: input.phonetic?.trim() ?? "",
    topicId: input.topicId?.trim() || null
  };

  try {
    const docRef = await addDoc(collection(db, "vocabularies"), {
      word: normalized.word,
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
      lastReviewedAt: null
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
  const normalized = {
    word: input.word.trim(),
    definition: input.definition.trim(),
    partOfSpeech: input.partOfSpeech?.trim() ?? "",
    phonetic: input.phonetic?.trim() ?? "",
    topicId: input.topicId?.trim() || null
  };

  try {
    await updateDoc(doc(db, "vocabularies", id), {
      word: normalized.word,
      definition: normalized.definition,
      partOfSpeech: normalized.partOfSpeech,
      phonetic: normalized.phonetic,
      topicId: normalized.topicId,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vocabularies/${id}`);
    throw error;
  }
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
      const vocabularies = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Vocabulary);
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
