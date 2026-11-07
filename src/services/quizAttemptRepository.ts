import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { OperationType, type QuizAttempt, type QuizAttemptResult, type Vocabulary } from "@/types/types";

export type RecordQuizAttemptInput = {
  userId: string;
  vocabulary: Pick<Vocabulary, "id" | "topicId">;
  result: QuizAttemptResult;
};

export async function recordQuizAttempt({ userId, vocabulary, result }: RecordQuizAttemptInput): Promise<void> {
  try {
    await addDoc(collection(db, "quizAttempts"), {
      userId,
      vocabularyId: vocabulary.id,
      topicId: vocabulary.topicId ?? null,
      result,
      attemptedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "quizAttempts");
    throw error;
  }
}

export function subscribeQuizAttemptsSince(
  userId: string,
  since: Date,
  onNext: (attempts: QuizAttempt[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const attemptsQuery = query(
    collection(db, "quizAttempts"),
    where("userId", "==", userId),
    where("attemptedAt", ">=", Timestamp.fromDate(since)),
    orderBy("attemptedAt", "desc")
  );

  return onSnapshot(
    attemptsQuery,
    (snapshot) => {
      onNext(
        snapshot.docs.map(
          (docItem) => ({ id: docItem.id, ...docItem.data({ serverTimestamps: "estimate" }) }) as QuizAttempt
        )
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, "quizAttempts");
      if (onError) onError(error);
    }
  );
}
