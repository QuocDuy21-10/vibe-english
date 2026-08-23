import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTopic,
  updateTopic,
  deleteTopic,
  subscribeTopics
} from "@/services/topicRepository";
import { addDoc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn((_db, name) => `collection:${name}`),
  doc: vi.fn((_db, name, id) => `doc:${name}/${id}`),
  query: vi.fn((...args) => ({ type: "query", args })),
  where: vi.fn((field, op, val) => ({ field, op, val })),
  orderBy: vi.fn((field, dir) => ({ field, dir })),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP")
}));

vi.mock("@/lib/firebase", () => ({
  db: {}
}));

vi.mock("@/lib/firestoreErrors", () => ({
  handleFirestoreError: vi.fn()
}));

import { handleFirestoreError } from "@/lib/firestoreErrors";

describe("topicRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTopic", () => {
    it("trims topic name and passes server timestamp", async () => {
      vi.mocked(addDoc).mockResolvedValueOnce({ id: "new-topic-1" } as any);

      const result = await createTopic("user-123", { name: "  Du Lịch  " });

      expect(addDoc).toHaveBeenCalledWith("collection:topics", {
        name: "Du Lịch",
        userId: "user-123",
        createdAt: "SERVER_TIMESTAMP"
      });
      expect(result).toBe("new-topic-1");
    });

    it("logs error and throws when addDoc fails", async () => {
      const error = new Error("Firestore write error");
      vi.mocked(addDoc).mockRejectedValueOnce(error);

      await expect(createTopic("user-123", { name: "Du Lịch" })).rejects.toThrow("Firestore write error");
      expect(handleFirestoreError).toHaveBeenCalledWith(error, "create", "topics");
    });
  });

  describe("updateTopic", () => {
    it("trims name and updates document", async () => {
      vi.mocked(updateDoc).mockResolvedValueOnce(undefined as any);

      await updateTopic("topic-1", { name: "  Công Việc Mới  " });

      expect(updateDoc).toHaveBeenCalledWith("doc:topics/topic-1", {
        name: "Công Việc Mới"
      });
    });

    it("logs error and throws when updateDoc fails", async () => {
      const error = new Error("Update permission denied");
      vi.mocked(updateDoc).mockRejectedValueOnce(error);

      await expect(updateTopic("topic-1", { name: "Test" })).rejects.toThrow("Update permission denied");
      expect(handleFirestoreError).toHaveBeenCalledWith(error, "update", "topics/topic-1");
    });
  });

  describe("deleteTopic", () => {
    it("calls deleteDoc on the topic reference", async () => {
      vi.mocked(deleteDoc).mockResolvedValueOnce(undefined as any);

      await deleteTopic("topic-1");

      expect(deleteDoc).toHaveBeenCalledWith("doc:topics/topic-1");
    });

    it("logs error and throws when deleteDoc fails", async () => {
      const error = new Error("Delete failed");
      vi.mocked(deleteDoc).mockRejectedValueOnce(error);

      await expect(deleteTopic("topic-1")).rejects.toThrow("Delete failed");
      expect(handleFirestoreError).toHaveBeenCalledWith(error, "delete", "topics/topic-1");
    });
  });

  describe("subscribeTopics", () => {
    it("subscribes to query and maps snapshot documents", () => {
      const mockUnsubscribe = vi.fn();
      let snapshotCallback: (snapshot: any) => void = () => {};

      vi.mocked(onSnapshot).mockImplementationOnce((_query, onNext: any) => {
        snapshotCallback = onNext;
        return mockUnsubscribe;
      });

      const onNext = vi.fn();
      const onError = vi.fn();

      const unsubscribe = subscribeTopics("user-123", onNext, onError);

      expect(onSnapshot).toHaveBeenCalled();

      // Trigger snapshot
      snapshotCallback({
        docs: [
          {
            id: "t1",
            data: () => ({ name: "Topic 1", userId: "user-123" })
          }
        ]
      });

      expect(onNext).toHaveBeenCalledWith([
        { id: "t1", name: "Topic 1", userId: "user-123" }
      ]);

      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it("handles error callback when onSnapshot fails", () => {
      let errorCallback: (error: any) => void = () => {};

      vi.mocked(onSnapshot).mockImplementationOnce((_query, _onNext: any, onError: any) => {
        errorCallback = onError;
        return vi.fn();
      });

      const onNext = vi.fn();
      const onError = vi.fn();

      subscribeTopics("user-123", onNext, onError);

      const error = new Error("Subscription failed");
      errorCallback(error);

      expect(handleFirestoreError).toHaveBeenCalledWith(error, "list", "topics");
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});
