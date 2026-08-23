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
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { OperationType, type Topic } from "@/types/types";

export type CreateTopicInput = {
  name: string;
};

export type UpdateTopicInput = {
  name: string;
};

export async function createTopic(userId: string, input: CreateTopicInput): Promise<string> {
  const normalizedName = input.name.trim();

  try {
    const docRef = await addDoc(collection(db, "topics"), {
      name: normalizedName,
      userId,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "topics");
    throw error;
  }
}

export async function updateTopic(topicId: string, input: UpdateTopicInput): Promise<void> {
  const normalizedName = input.name.trim();

  try {
    await updateDoc(doc(db, "topics", topicId), {
      name: normalizedName
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `topics/${topicId}`);
    throw error;
  }
}

export async function deleteTopic(topicId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "topics", topicId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `topics/${topicId}`);
    throw error;
  }
}

export function subscribeTopics(
  userId: string,
  onNext: (topics: Topic[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const topicsQuery = query(
    collection(db, "topics"),
    whereUserId(userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    topicsQuery,
    (snapshot) => {
      const topics = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Topic);
      onNext(topics);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, "topics");
      if (onError) {
        onError(error);
      }
    }
  );
}

function whereUserId(userId: string) {
  return where("userId", "==", userId);
}
