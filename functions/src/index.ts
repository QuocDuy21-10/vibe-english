import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  runVocabularyReminderDispatch,
  type DispatchDependencies
} from "./sendVocabularyReminders";

const DATABASE_ID = "ai-studio-5ce4ff1b-cd4e-4400-b368-cedf76f6e3ea";
const app = getApps()[0] ?? initializeApp();
const db = getFirestore(app, DATABASE_ID);

const dependencies: DispatchDependencies = {
  async listDevices() {
    const snapshot = await db.collectionGroup("devices").get();
    return snapshot.docs.flatMap((device) => {
      const data = device.data();
      return typeof data.userId === "string" && typeof data.token === "string"
        ? [{ path: device.ref.path, userId: data.userId, token: data.token }]
        : [];
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
      lastWindowKey: typeof data?.lastWindowKey === "string" ? data.lastWindowKey : null,
      lastVocabularyId: typeof data?.lastVocabularyId === "string" ? data.lastVocabularyId : null
    };
  },
  async claimWindow(userId, windowKey, vocabularyId, now) {
    const stateRef = db.doc(`notificationDispatchStates/${userId}`);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(stateRef);
      if (snapshot.data()?.lastWindowKey === windowKey) return false;

      transaction.set(stateRef, {
        lastWindowKey: windowKey,
        lastVocabularyId: vocabularyId,
        lastSentAt: Timestamp.fromDate(now)
      });
      return true;
    });
  },
  async sendBatch(message) {
    const response = await getMessaging(app).sendEachForMulticast({
      tokens: message.tokens,
      data: message.data,
      webpush: {
        headers: { Urgency: "normal" }
      }
    });
    return {
      responses: response.responses.map((item) => ({
        success: item.success,
        errorCode: item.error?.code
      }))
    };
  },
  async deleteDevice(path) {
    await db.doc(path).delete();
  },
  logError(context, errorCode) {
    console.error(context, { errorCode: errorCode ?? "unknown" });
  }
};

export const sendVocabularyReminders = onSchedule(
  {
    schedule: "0 */2 * * *",
    timeZone: "Asia/Ho_Chi_Minh",
    region: "asia-southeast1"
  },
  async () => {
    await runVocabularyReminderDispatch(dependencies, new Date());
  }
);
