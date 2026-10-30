// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let authListener: ((user: { uid: string } | null) => void) | undefined;
  let topicsListener: ((topics: unknown[]) => void) | undefined;
  let vocabulariesListener: ((vocabularies: unknown[]) => void) | undefined;

  return {
    auth: {},
    emitAuth: (user: { uid: string } | null) => authListener?.(user),
    emitTopics: (topics: unknown[]) => topicsListener?.(topics),
    emitVocabularies: (vocabularies: unknown[]) => vocabulariesListener?.(vocabularies),
    onAuthStateChanged: vi.fn((_auth: unknown, listener: (user: { uid: string } | null) => void) => {
      authListener = listener;
      return vi.fn();
    }),
    subscribeTopics: vi.fn((_userId: string, listener: (topics: unknown[]) => void) => {
      topicsListener = listener;
      return vi.fn();
    }),
    subscribeVocabularies: vi.fn((_userId: string, listener: (vocabularies: unknown[]) => void) => {
      vocabulariesListener = listener;
      return vi.fn();
    }),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    revokeVocabularyNotificationsForLogout: vi.fn(),
    runLogoutWithNotificationCleanup: vi.fn(async (_cleanup: () => Promise<void>, signOut: () => Promise<void>) => {
      await signOut();
      return "completed";
    }),
    toast: {
      success: vi.fn(),
      info: vi.fn(),
      error: vi.fn()
    }
  };
});

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class GoogleAuthProvider {},
  onAuthStateChanged: mocks.onAuthStateChanged,
  signInWithPopup: mocks.signInWithPopup,
  signOut: mocks.signOut
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/firebase", () => ({ auth: mocks.auth }));
vi.mock("@/services/topicRepository", () => ({ subscribeTopics: mocks.subscribeTopics }));
vi.mock("@/services/vocabularyRepository", () => ({ subscribeVocabularies: mocks.subscribeVocabularies }));
vi.mock("@/services/notificationService", () => ({
  revokeVocabularyNotificationsForLogout: mocks.revokeVocabularyNotificationsForLogout
}));
vi.mock("@/lib/logout", () => ({
  runLogoutWithNotificationCleanup: mocks.runLogoutWithNotificationCleanup
}));

import { AppDataProvider, useAuth, useVocabularyData } from "@/routes/AppDataProvider";

function AuthProbe({ onRender }: { onRender: () => void }) {
  useAuth();
  onRender();
  return null;
}

function DataProbe({ onRender }: { onRender: (topics: unknown[], vocabularies: unknown[]) => void }) {
  const { topics, vocabularies } = useVocabularyData();
  onRender(topics, vocabularies);
  return null;
}

describe("AppDataProvider context boundaries", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("updates collection consumers without rerendering auth-only consumers", () => {
    let authRenderCount = 0;
    const dataSnapshots: Array<{ topics: unknown[]; vocabularies: unknown[] }> = [];

    render(
      <AppDataProvider>
        <AuthProbe onRender={() => { authRenderCount += 1; }} />
        <DataProbe onRender={(topics, vocabularies) => dataSnapshots.push({ topics, vocabularies })} />
      </AppDataProvider>
    );

    act(() => mocks.emitAuth({ uid: "user-1" }));
    const authRendersAfterAuth = authRenderCount;

    act(() => {
      mocks.emitTopics([{ id: "topic-1" }]);
      mocks.emitVocabularies([{ id: "vocab-1" }]);
    });

    expect(mocks.subscribeTopics).toHaveBeenCalledWith("user-1", expect.any(Function), expect.any(Function));
    expect(mocks.subscribeVocabularies).toHaveBeenCalledWith("user-1", expect.any(Function), expect.any(Function));
    expect(authRenderCount).toBe(authRendersAfterAuth);
    expect(dataSnapshots.at(-1)).toEqual({
      topics: [{ id: "topic-1" }],
      vocabularies: [{ id: "vocab-1" }]
    });
  });

  it("requires focused hooks to be used inside AppDataProvider", () => {
    expect(() => render(<AuthProbe onRender={() => undefined} />)).toThrow(
      "useAuth must be used within AppDataProvider"
    );
    expect(() => render(<DataProbe onRender={() => undefined} />)).toThrow(
      "useVocabularyData must be used within AppDataProvider"
    );
  });
});
