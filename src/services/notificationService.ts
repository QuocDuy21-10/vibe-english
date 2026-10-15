import { getId, getInstallations } from "firebase/installations";
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Unsubscribe
} from "firebase/messaging";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db, firebaseApp } from "@/lib/firebase";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { OperationType } from "@/types/types";

export type NotificationCapability = "unsupported" | "denied" | "prompt" | "granted";

export type DeviceSubscriptionState = {
  capability: NotificationCapability;
  subscribed: boolean;
};

export type DeviceNotificationCleanupResult = {
  registrationRemoved: true;
  tokenInvalidated: boolean;
};

export class NotificationPermissionDeniedError extends Error {
  constructor() {
    super("Quyền thông báo đã bị từ chối.");
    this.name = "NotificationPermissionDeniedError";
  }
}

export type ForegroundVocabularyMessage = {
  title: string;
  body: string;
  vocabularyId: string;
  word: string;
  url: string;
};

function getVapidKey(): string {
  return import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim() ?? "";
}

function getPlatform(): string {
  const value = navigator.userAgent.trim() || "Unknown browser";
  return Array.from(value).slice(0, 300).join("");
}

async function getDeviceReference(userId: string) {
  const installationId = await getId(getInstallations(firebaseApp));
  return doc(db, "notificationUsers", userId, "devices", installationId);
}

export async function getNotificationCapability(): Promise<NotificationCapability> {
  if (
    !globalThis.isSecureContext ||
    typeof Notification === "undefined" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !(await isSupported())
  ) {
    return "unsupported";
  }

  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "granted";
  return "prompt";
}

export async function getCurrentDeviceSubscription(
  userId: string
): Promise<DeviceSubscriptionState> {
  const capability = await getNotificationCapability();
  if (capability !== "granted") return { capability, subscribed: false };

  const snapshot = await getDoc(await getDeviceReference(userId));
  return { capability, subscribed: snapshot.exists() };
}

export async function enableVocabularyNotifications(userId: string): Promise<void> {
  const capability = await getNotificationCapability();
  if (capability === "unsupported") {
    throw new Error("Trình duyệt này không hỗ trợ thông báo đẩy.");
  }
  if (capability === "denied") {
    throw new NotificationPermissionDeniedError();
  }

  const vapidKey = getVapidKey();
  if (!vapidKey) {
    throw new Error("Thiếu cấu hình VAPID cho thông báo đẩy.");
  }

  const permission = capability === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new NotificationPermissionDeniedError();
  }

  const registeredServiceWorker = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js",
    { type: "module" }
  );
  const serviceWorkerRegistration = registeredServiceWorker.active
    ? registeredServiceWorker
    : await navigator.serviceWorker.ready;
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
  if (!token) {
    throw new Error("Không thể tạo đăng ký thông báo cho thiết bị này.");
  }

  const deviceRef = await getDeviceReference(userId);
  try {
    const snapshot = await getDoc(deviceRef);
    if (snapshot.exists()) {
      await updateDoc(deviceRef, {
        token,
        platform: getPlatform(),
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(deviceRef, {
        userId,
        token,
        platform: getPlatform(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    const path = typeof deviceRef === "string" ? deviceRef : (deviceRef as { path?: string }).path ?? null;
    handleFirestoreError(error, OperationType.WRITE, path);
    try {
      await deleteToken(messaging);
    } catch (cleanupError) {
      console.warn("Unable to invalidate FCM token after registration failure", cleanupError);
    }
    throw error;
  }
}

export async function disableVocabularyNotifications(
  userId: string
): Promise<DeviceNotificationCleanupResult> {
  const deviceRef = await getDeviceReference(userId);
  try {
    await deleteDoc(deviceRef);
  } catch (error) {
    const path = typeof deviceRef === "string" ? deviceRef : (deviceRef as { path?: string }).path ?? null;
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
  let tokenInvalidated = true;
  try {
    if (await isSupported()) {
      tokenInvalidated = await deleteToken(getMessaging(firebaseApp));
    }
  } catch (error) {
    tokenInvalidated = false;
    console.warn("Unable to invalidate the local FCM token", error);
  }
  return { registrationRemoved: true, tokenInvalidated };
}

export async function invalidateVocabularyNotificationToken(): Promise<void> {
  if (await isSupported()) {
    await deleteToken(getMessaging(firebaseApp));
  }
}

export async function revokeVocabularyNotificationsForLogout(userId: string): Promise<void> {
  const registrationPromise = getDeviceReference(userId).then((deviceRef) => deleteDoc(deviceRef));
  const tokenPromise = invalidateVocabularyNotificationToken();
  const [registrationResult, tokenResult] = await Promise.allSettled([
    registrationPromise,
    tokenPromise
  ]);

  if (registrationResult.status === "rejected" || tokenResult.status === "rejected") {
    throw new Error("Không thể thu hồi hoàn toàn đăng ký thông báo trên thiết bị.", {
      cause:
        tokenResult.status === "rejected"
          ? tokenResult.reason
          : registrationResult.status === "rejected"
            ? registrationResult.reason
            : undefined
    });
  }
}

function normalizeForegroundMessage(payload: MessagePayload): ForegroundVocabularyMessage {
  const data = payload.data ?? {};
  return {
    title: data.title ?? "Từ vựng Vocabloom",
    body: data.body ?? "Mở Vocabloom để ôn tập từ vựng.",
    vocabularyId: data.vocabularyId ?? "",
    word: data.word ?? "",
    url: data.url ?? "/dictionary"
  };
}

export async function subscribeToForegroundVocabularyMessages(
  listener: (message: ForegroundVocabularyMessage) => void
): Promise<Unsubscribe> {
  const capability = await getNotificationCapability();
  if (capability !== "granted") return () => undefined;

  return onMessage(getMessaging(firebaseApp), (payload) => {
    listener(normalizeForegroundMessage(payload));
  });
}
