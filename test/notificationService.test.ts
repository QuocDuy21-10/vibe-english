import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isSupported: vi.fn(),
  getMessaging: vi.fn(() => ({ name: "messaging" })),
  getToken: vi.fn(),
  deleteToken: vi.fn(),
  onMessage: vi.fn(),
  getInstallations: vi.fn(() => ({ name: "installations" })),
  getId: vi.fn(),
  doc: vi.fn((_db: unknown, ...segments: string[]) => segments.join("/")),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  foregroundHandler: undefined as ((payload: unknown) => void) | undefined
}));

vi.mock("firebase/messaging", () => ({
  isSupported: mocks.isSupported,
  getMessaging: mocks.getMessaging,
  getToken: mocks.getToken,
  deleteToken: mocks.deleteToken,
  onMessage: mocks.onMessage
}));

vi.mock("firebase/installations", () => ({
  getInstallations: mocks.getInstallations,
  getId: mocks.getId
}));

vi.mock("firebase/firestore", () => ({
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  setDoc: mocks.setDoc,
  updateDoc: mocks.updateDoc,
  deleteDoc: mocks.deleteDoc,
  serverTimestamp: mocks.serverTimestamp
}));

vi.mock("@/lib/firebase", () => ({
  firebaseApp: { name: "app" },
  db: { name: "db" }
}));

import {
  disableVocabularyNotifications,
  enableVocabularyNotifications,
  getCurrentDeviceSubscription,
  getNotificationCapability,
  NotificationPermissionDeniedError,
  revokeVocabularyNotificationsForLogout,
  subscribeToForegroundVocabularyMessages
} from "@/services/notificationService";

function installBrowserNotification(
  permission: NotificationPermission,
  requestedPermission: NotificationPermission = permission
) {
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: {
      permission,
      requestPermission: vi.fn().mockResolvedValue(requestedPermission)
    }
  });
}

const register = vi.fn();
const activeRegistration = { scope: "https://example.com/", active: { state: "activated" } };

describe("notificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_FIREBASE_VAPID_KEY", "test-public-vapid-key");
    installBrowserNotification("default", "granted");
    Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        userAgent: "Test Browser",
        serviceWorker: { register, ready: Promise.resolve(activeRegistration) }
      }
    });
    register.mockResolvedValue(activeRegistration);
    mocks.isSupported.mockResolvedValue(true);
    mocks.getId.mockResolvedValue("installation-1");
    mocks.getToken.mockResolvedValue("fcm-token-1");
    mocks.deleteToken.mockResolvedValue(true);
    mocks.getDoc.mockResolvedValue({ exists: () => false });
    mocks.setDoc.mockResolvedValue(undefined);
    mocks.updateDoc.mockResolvedValue(undefined);
    mocks.deleteDoc.mockResolvedValue(undefined);
    mocks.onMessage.mockImplementation((_messaging, handler) => {
      mocks.foregroundHandler = handler;
      return vi.fn();
    });
  });

  it("reports unsupported without registering FCM", async () => {
    mocks.isSupported.mockResolvedValue(false);

    await expect(getNotificationCapability()).resolves.toBe("unsupported");
    await expect(getCurrentDeviceSubscription("alice")).resolves.toEqual({
      capability: "unsupported",
      subscribed: false
    });
    expect(register).not.toHaveBeenCalled();
    expect(mocks.getToken).not.toHaveBeenCalled();
  });

  it("rejects enablement when the public VAPID key is missing", async () => {
    vi.stubEnv("VITE_FIREBASE_VAPID_KEY", "");

    await expect(enableVocabularyNotifications("alice")).rejects.toThrow("VAPID");
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });

  it("rejects enablement when browser permission is denied", async () => {
    installBrowserNotification("default", "denied");

    await expect(enableVocabularyNotifications("alice")).rejects.toBeInstanceOf(
      NotificationPermissionDeniedError
    );
    expect(register).not.toHaveBeenCalled();
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it("does not ask again when notification permission is already denied", async () => {
    installBrowserNotification("denied");

    await expect(enableVocabularyNotifications("alice")).rejects.toBeInstanceOf(
      NotificationPermissionDeniedError
    );
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it("waits for the registered service worker to become active before requesting a token", async () => {
    const installingRegistration = { scope: "https://example.com/", installing: { state: "installing" } };
    const readyRegistration = { scope: "https://example.com/", active: { state: "activated" } };
    register.mockResolvedValue(installingRegistration);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        userAgent: "Test Browser",
        serviceWorker: { register, ready: Promise.resolve(readyRegistration) }
      }
    });

    await enableVocabularyNotifications("alice");

    expect(mocks.getToken).toHaveBeenCalledWith(
      { name: "messaging" },
      expect.objectContaining({ serviceWorkerRegistration: readyRegistration })
    );
  });

  it("persists a new installation after permission is granted", async () => {
    await enableVocabularyNotifications("alice");

    expect(register).toHaveBeenCalledWith("/firebase-messaging-sw.js", { type: "module" });
    expect(mocks.getToken).toHaveBeenCalledWith(
      { name: "messaging" },
      {
        vapidKey: "test-public-vapid-key",
        serviceWorkerRegistration: activeRegistration
      }
    );
    expect(mocks.setDoc).toHaveBeenCalledWith(
      "notificationUsers/alice/devices/installation-1",
      {
        userId: "alice",
        token: "fcm-token-1",
        platform: "Test Browser",
        createdAt: "SERVER_TIMESTAMP",
        updatedAt: "SERVER_TIMESTAMP"
      }
    );
  });

  it("invalidates the new FCM token when persistence fails", async () => {
    mocks.setDoc.mockRejectedValue(new Error("Firestore unavailable"));

    await expect(enableVocabularyNotifications("alice")).rejects.toThrow("Firestore unavailable");
    expect(mocks.deleteToken).toHaveBeenCalledWith({ name: "messaging" });
  });

  it("updates an existing installation without replacing createdAt", async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true });

    await enableVocabularyNotifications("alice");

    expect(mocks.updateDoc).toHaveBeenCalledWith(
      "notificationUsers/alice/devices/installation-1",
      {
        token: "fcm-token-1",
        platform: "Test Browser",
        updatedAt: "SERVER_TIMESTAMP"
      }
    );
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it("deletes the device registration before invalidating the FCM token", async () => {
    await disableVocabularyNotifications("alice");

    expect(mocks.deleteDoc).toHaveBeenCalledWith("notificationUsers/alice/devices/installation-1");
    expect(mocks.deleteToken).toHaveBeenCalledWith({ name: "messaging" });
  });

  it("preserves the FCM token when registration deletion fails", async () => {
    mocks.deleteDoc.mockRejectedValue(new Error("Firestore unavailable"));

    await expect(disableVocabularyNotifications("alice")).rejects.toThrow("Firestore unavailable");
    expect(mocks.deleteToken).not.toHaveBeenCalled();
  });

  it("reports disabled when registration deletion succeeds but local token cleanup fails", async () => {
    mocks.deleteToken.mockRejectedValue(new Error("Messaging unavailable"));

    await expect(disableVocabularyNotifications("alice")).resolves.toEqual({
      registrationRemoved: true,
      tokenInvalidated: false
    });
  });

  it("invalidates the FCM token during logout even when registration deletion fails", async () => {
    mocks.deleteDoc.mockRejectedValue(new Error("Firestore unavailable"));

    await expect(revokeVocabularyNotificationsForLogout("alice")).rejects.toThrow(
      "Không thể thu hồi hoàn toàn"
    );
    expect(mocks.deleteToken).toHaveBeenCalledWith({ name: "messaging" });
  });

  it("starts token invalidation without waiting for an offline deletion", async () => {
    mocks.deleteDoc.mockImplementation(() => new Promise(() => undefined));

    void revokeVocabularyNotificationsForLogout("alice");
    await vi.waitFor(() => {
      expect(mocks.deleteToken).toHaveBeenCalledWith({ name: "messaging" });
    });
  });

  it("normalizes foreground message data for the UI listener", async () => {
    installBrowserNotification("granted");
    const listener = vi.fn();

    const unsubscribe = await subscribeToForegroundVocabularyMessages(listener);
    mocks.foregroundHandler?.({
      data: {
        title: "Từ vựng: apple",
        body: "noun • quả táo",
        vocabularyId: "vocab-1",
        word: "apple",
        url: "/dictionary"
      }
    });

    expect(listener).toHaveBeenCalledWith({
      title: "Từ vựng: apple",
      body: "noun • quả táo",
      vocabularyId: "vocab-1",
      word: "apple",
      url: "/dictionary"
    });
    expect(typeof unsubscribe).toBe("function");
  });
});
