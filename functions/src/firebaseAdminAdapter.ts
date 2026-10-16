import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import {
  evaluateWindowLease,
  type DeviceDeliveryOutcome,
  type DispatchDependencies,
  type DispatchInvocation,
  type NotificationDeviceRecord,
  type WindowDispatchStatus,
  type WindowFinalizationCounts
} from "./sendVocabularyReminders";

const APP_NAME = "vocabulary-reminder-dispatch";
const LEASE_DURATION_MS = 10 * 60 * 1000;

export interface FirebaseAdminDispatchConfig {
  projectId: string;
  databaseId: string;
}

function getOrInitializeApp(projectId: string): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  return existing ?? initializeApp({ credential: applicationDefault(), projectId }, APP_NAME);
}

function parseOutcome(data: FirebaseFirestore.DocumentData, installationId: string): DeviceDeliveryOutcome | null {
  const status = data.status;
  if (
    status !== "ACCEPTED"
    && status !== "INVALID"
    && status !== "PERMANENT_FAILURE"
    && status !== "RETRYABLE_FAILURE"
  ) {
    return null;
  }
  return {
    installationId,
    status,
    attempts: typeof data.attempts === "number" ? data.attempts : 0,
    errorCategory: typeof data.errorCategory === "string" ? data.errorCategory : null
  };
}

function windowReference(db: Firestore, userId: string, windowKey: string) {
  return db.doc(`notificationDispatchStates/${userId}/windows/${windowKey}`);
}

export function createFirebaseAdminDispatchDependencies(
  config: FirebaseAdminDispatchConfig
): DispatchDependencies {
  if (!config.projectId.trim()) throw new Error("FIREBASE_PROJECT_ID is required");
  if (!config.databaseId.trim() || config.databaseId === "(default)") {
    throw new Error("A non-default FIRESTORE_DATABASE_ID is required");
  }

  const app = getOrInitializeApp(config.projectId);
  const db = getFirestore(app, config.databaseId);

  return {
    async listDevices() {
      const snapshot = await db.collectionGroup("devices").get();
      return snapshot.docs.flatMap((device): NotificationDeviceRecord[] => {
        const data = device.data();
        const segments = device.ref.path.split("/");
        const pathUserId = segments.length === 4 && segments[0] === "notificationUsers"
          && segments[2] === "devices"
          ? segments[1]
          : null;
        if (
          !pathUserId
          || data.userId !== pathUserId
          || typeof data.token !== "string"
          || data.token.length === 0
        ) {
          return [];
        }
        return [{
          path: device.ref.path,
          installationId: device.id,
          userId: pathUserId,
          token: data.token,
          updateTime: device.updateTime.toDate().toISOString()
        }];
      });
    },

    async listVocabularies(userId) {
      const snapshot = await db.collection("vocabularies").where("userId", "==", userId).get();
      return snapshot.docs.flatMap((vocabulary) => {
        const data = vocabulary.data();
        return typeof data.word === "string" && typeof data.definition === "string"
          ? [{
              id: vocabulary.id,
              word: data.word,
              phonetic: typeof data.phonetic === "string" ? data.phonetic : "",
              partOfSpeech: typeof data.partOfSpeech === "string" ? data.partOfSpeech : "",
              definition: data.definition
            }]
          : [];
      });
    },

    async getDispatchState(userId) {
      const snapshot = await db.doc(`notificationDispatchStates/${userId}`).get();
      const data = snapshot.data();
      return {
        lastVocabularyId: typeof data?.lastVocabularyId === "string" ? data.lastVocabularyId : null
      };
    },

    async acquireWindowLease(userId, windowKey, vocabularyId, invocation) {
      const reference = windowReference(db, userId, windowKey);
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        const data = snapshot.data();
        const existingStatus = data?.status;
        const status: WindowDispatchStatus = existingStatus === "PROCESSING"
          || existingStatus === "RETRYABLE"
          || existingStatus === "SENT"
          || existingStatus === "FAILED"
          ? existingStatus
          : "RETRYABLE";
        const decision = snapshot.exists
          ? evaluateWindowLease({
              status,
              leaseOwner: typeof data?.leaseOwner === "string" ? data.leaseOwner : null,
              leaseExpiresAt: data?.leaseExpiresAt instanceof Timestamp
                ? data.leaseExpiresAt.toDate()
                : null
            }, invocation.executedAt, invocation.runId)
          : "acquired";
        const selectedVocabularyId = typeof data?.vocabularyId === "string"
          ? data.vocabularyId
          : vocabularyId;
        if (decision !== "acquired") {
          return { result: decision, vocabularyId: selectedVocabularyId };
        }
        transaction.set(reference, {
          status: "PROCESSING",
          scheduledAt: Timestamp.fromDate(invocation.scheduledAt),
          startedAt: data?.startedAt instanceof Timestamp
            ? data.startedAt
            : Timestamp.fromDate(invocation.executedAt),
          updatedAt: Timestamp.fromDate(invocation.executedAt),
          vocabularyId: selectedVocabularyId,
          leaseOwner: invocation.runId,
          leaseExpiresAt: Timestamp.fromMillis(
            invocation.executedAt.getTime() + LEASE_DURATION_MS
          ),
          attemptCount: typeof data?.attemptCount === "number" ? data.attemptCount + 1 : 1
        }, { merge: true });
        return { result: "acquired" as const, vocabularyId: selectedVocabularyId };
      });
    },

    async renewWindowLease(userId, windowKey, runId, now) {
      const reference = windowReference(db, userId, windowKey);
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (snapshot.data()?.leaseOwner !== runId) {
          throw new Error("Dispatch lease is no longer owned by this run");
        }
        transaction.update(reference, {
          updatedAt: Timestamp.fromDate(now),
          leaseExpiresAt: Timestamp.fromMillis(now.getTime() + LEASE_DURATION_MS)
        });
      });
    },

    async listDeviceOutcomes(userId, windowKey) {
      const snapshot = await windowReference(db, userId, windowKey).collection("devices").get();
      return Object.fromEntries(snapshot.docs.flatMap((document) => {
        const outcome = parseOutcome(document.data(), document.id);
        return outcome ? [[document.id, outcome]] : [];
      }));
    },

    async recordDeviceOutcomes(userId, windowKey, outcomes, now) {
      const batch = db.batch();
      const collection = windowReference(db, userId, windowKey).collection("devices");
      for (const outcome of outcomes) {
        batch.set(collection.doc(outcome.installationId), {
          status: outcome.status,
          attempts: outcome.attempts,
          errorCategory: outcome.errorCategory,
          updatedAt: Timestamp.fromDate(now)
        }, { merge: true });
      }
      await batch.commit();
    },

    async finalizeWindow(
      userId: string,
      windowKey: string,
      vocabularyId: string,
      status: WindowDispatchStatus,
      counts: WindowFinalizationCounts,
      invocation: DispatchInvocation,
      now: Date
    ) {
      const reference = windowReference(db, userId, windowKey);
      const stateReference = db.doc(`notificationDispatchStates/${userId}`);
      await db.runTransaction(async (transaction) => {
        const [windowSnapshot, stateSnapshot] = await Promise.all([
          transaction.get(reference),
          transaction.get(stateReference)
        ]);
        if (windowSnapshot.data()?.leaseOwner !== invocation.runId) {
          throw new Error("Dispatch lease is no longer owned by this run");
        }
        transaction.set(reference, {
          status,
          acceptedCount: counts.accepted,
          failedCount: counts.failed,
          invalidCount: counts.invalid,
          retryableCount: counts.retryable,
          updatedAt: Timestamp.fromDate(now),
          completedAt: status === "RETRYABLE" ? null : Timestamp.fromDate(now),
          leaseOwner: FieldValue.delete(),
          leaseExpiresAt: FieldValue.delete()
        }, { merge: true });
        const previousSentAt = stateSnapshot.data()?.lastScheduledAt;
        if (
          counts.accepted > 0
          && (!(previousSentAt instanceof Timestamp)
            || previousSentAt.toMillis() <= invocation.scheduledAt.getTime())
        ) {
          transaction.set(stateReference, {
            lastWindowKey: windowKey,
            lastVocabularyId: vocabularyId,
            lastSentAt: Timestamp.fromDate(now),
            lastScheduledAt: Timestamp.fromDate(invocation.scheduledAt)
          }, { merge: true });
        }
      });
    },

    async sendBatch(message) {
      const response = await getMessaging(app).sendEachForMulticast({
        tokens: message.tokens,
        data: message.data,
        webpush: { headers: { Urgency: "normal" } }
      });
      return {
        responses: response.responses.map((item) => ({
          success: item.success,
          errorCode: item.error?.code
        }))
      };
    },

    async deleteDeviceIfTokenMatches(device) {
      const reference = db.doc(device.path);
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        const updateTime = snapshot.updateTime;
        if (
          snapshot.exists
          && updateTime
          && snapshot.data()?.token === device.token
          && updateTime.toDate().toISOString() === device.updateTime
        ) {
          transaction.delete(reference);
        }
      });
    },

    sleep(delayMs) {
      return new Promise((resolve) => setTimeout(resolve, delayMs));
    },

    logError(context, errorCode) {
      console.error(JSON.stringify({
        event: "vocabulary-reminder-error",
        context,
        errorCode: errorCode ?? "unknown"
      }));
    }
  };
}
