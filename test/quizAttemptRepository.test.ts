import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDoc, onSnapshot } from "firebase/firestore";
import { recordQuizAttempt, subscribeQuizAttemptsSince } from "@/services/quizAttemptRepository";

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn((_db, name) => `collection:${name}`),
  query: vi.fn((...args) => ({ type: "query", args })),
  where: vi.fn((field, op, val) => ({ field, op, val })),
  orderBy: vi.fn((field, dir) => ({ field, dir })),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  Timestamp: { fromDate: vi.fn((date: Date) => `TS:${date.toISOString()}`) }
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/firestoreErrors", () => ({ handleFirestoreError: vi.fn() }));

import { handleFirestoreError } from "@/lib/firestoreErrors";

describe("quizAttemptRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records an attempt with exactly the five allowed fields", async () => {
    vi.mocked(addDoc).mockResolvedValueOnce({ id: "a1" } as any);

    await recordQuizAttempt({
      userId: "user-1",
      vocabulary: { id: "v1", topicId: "t1" },
      result: "incorrect"
    });

    expect(addDoc).toHaveBeenCalledWith("collection:quizAttempts", {
      userId: "user-1",
      vocabularyId: "v1",
      topicId: "t1",
      result: "incorrect",
      attemptedAt: "SERVER_TIMESTAMP"
    });
  });

  it("stores null topicId for unassigned vocabulary", async () => {
    vi.mocked(addDoc).mockResolvedValueOnce({ id: "a2" } as any);

    await recordQuizAttempt({
      userId: "user-1",
      vocabulary: { id: "v2", topicId: null },
      result: "revealed"
    });

    expect(vi.mocked(addDoc).mock.calls[0][1]).toMatchObject({ topicId: null, result: "revealed" });
  });

  it("reports and rethrows write failures", async () => {
    const error = new Error("denied");
    vi.mocked(addDoc).mockRejectedValueOnce(error);

    await expect(
      recordQuizAttempt({ userId: "user-1", vocabulary: { id: "v1", topicId: null }, result: "correct" })
    ).rejects.toThrow("denied");
    expect(handleFirestoreError).toHaveBeenCalledWith(error, "create", "quizAttempts");
  });

  it("subscribes to the user's attempts since a date and maps documents", () => {
    const unsubscribe = vi.fn();
    vi.mocked(onSnapshot).mockImplementationOnce(((_query: unknown, onNext: (snapshot: unknown) => void) => {
      onNext({
        docs: [
          {
            id: "a1",
            data: (options: unknown) => {
              expect(options).toEqual({ serverTimestamps: "estimate" });
              return { userId: "user-1", vocabularyId: "v1", topicId: null, result: "correct", attemptedAt: "X" };
            }
          }
        ]
      });
      return unsubscribe;
    }) as any);
    const onNext = vi.fn();
    const since = new Date(2026, 8, 1);

    const result = subscribeQuizAttemptsSince("user-1", since, onNext);

    expect(result).toBe(unsubscribe);
    expect(onNext).toHaveBeenCalledWith([
      { id: "a1", userId: "user-1", vocabularyId: "v1", topicId: null, result: "correct", attemptedAt: "X" }
    ]);
    const queryArgs = vi.mocked(onSnapshot).mock.calls[0][0] as unknown as { args: unknown[] };
    expect(queryArgs.args).toContainEqual({ field: "userId", op: "==", val: "user-1" });
    expect(queryArgs.args).toContainEqual({ field: "attemptedAt", op: ">=", val: `TS:${since.toISOString()}` });
  });

  it("reports subscription errors and forwards them", () => {
    const error = new Error("index missing");
    vi.mocked(onSnapshot).mockImplementationOnce(((_q: unknown, _next: unknown, onError: (e: unknown) => void) => {
      onError(error);
      return vi.fn();
    }) as any);
    const onError = vi.fn();

    subscribeQuizAttemptsSince("user-1", new Date(), vi.fn(), onError);

    expect(handleFirestoreError).toHaveBeenCalledWith(error, "list", "quizAttempts");
    expect(onError).toHaveBeenCalledWith(error);
  });
});
