import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { OperationType, type UserSettings } from "@/types/types";

export function subscribeUserSettings(
  userId: string,
  onNext: (settings: UserSettings | null) => void,
  onError?: (error: unknown) => void
): () => void {
  return onSnapshot(
    doc(db, "userSettings", userId),
    (snapshot) => {
      onNext(snapshot.exists() ? (snapshot.data({ serverTimestamps: "estimate" }) as UserSettings) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `userSettings/${userId}`);
      if (onError) onError(error);
    }
  );
}

export async function setDailyGoal(userId: string, dailyGoal: number): Promise<void> {
  try {
    await setDoc(doc(db, "userSettings", userId), {
      dailyGoal,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `userSettings/${userId}`);
    throw error;
  }
}
