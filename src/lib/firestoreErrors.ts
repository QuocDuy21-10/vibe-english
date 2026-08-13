import { auth } from "./firebase";
import type { FirestoreErrorInfo } from "../types/types";
import { OperationType } from "../types/types";

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      isAuthenticated: auth.currentUser !== null,
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
}
