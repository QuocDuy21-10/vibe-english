import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { OperationType, type ReviewEvent } from "@/types/types";

export async function getReviewEventsSince(
  userId: string,
  sinceDate: Date
): Promise<ReviewEvent[]> {
  try {
    const q = query(
      collection(db, "reviewEvents"),
      where("userId", "==", userId),
      where("reviewedAt", ">=", Timestamp.fromDate(sinceDate)),
      orderBy("reviewedAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    })) as ReviewEvent[];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "reviewEvents");
    throw error;
  }
}

export function subscribeReviewEventsSince(
  userId: string,
  since: Date,
  onNext: (events: ReviewEvent[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const q = query(
    collection(db, "reviewEvents"),
    where("userId", "==", userId),
    where("reviewedAt", ">=", Timestamp.fromDate(since)),
    orderBy("reviewedAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const events = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data({ serverTimestamps: "estimate" })
      })) as ReviewEvent[];
      onNext(events);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, "reviewEvents");
      if (onError) onError(error);
    }
  );
}
