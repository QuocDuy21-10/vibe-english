import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVocabulary,
  updateVocabulary,
  deleteVocabulary,
  updateVocabularyReview,
  recordVocabularyReview,
  subscribeVocabularies
} from "@/services/vocabularyRepository";
import { addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from "firebase/firestore";
import type { ScheduleUpdate } from "@/lib/srs";
import type { Vocabulary } from "@/types/types";

const mockBatch = {
  update: vi.fn(),
  set: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined)
};

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn((_db, name) => `collection:${name}`),
  doc: vi.fn((...args: any[]) => {
    if (args.length === 1 && typeof args[0] === "string" && args[0].startsWith("collection:")) {
      const colName = args[0].replace("collection:", "");
      return `doc:${colName}/generated-id`;
    }
    const [_db, name, id] = args;
    return id ? `doc:${name}/${id}` : `doc:${name}/generated-id`;
  }),
  query: vi.fn((...args) => ({ type: "query", args })),
  where: vi.fn((field, op, val) => ({ field, op, val })),
  orderBy: vi.fn((field, dir) => ({ field, dir })),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  writeBatch: vi.fn(() => mockBatch)
}));



vi.mock("@/lib/firebase", () => ({
  db: {}
}));

vi.mock("@/lib/firestoreErrors", () => ({
  handleFirestoreError: vi.fn()
}));

import { handleFirestoreError } from "@/lib/firestoreErrors";

describe("vocabularyRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createVocabulary", () => {
    it("normalizes inputs and creates full SRS payload matching security rules", async () => {
      vi.mocked(addDoc).mockResolvedValueOnce({ id: "vocab-1" } as any);

      const result = await createVocabulary("user-123", {
        word: "  ubiquitous  ",
        definition: "  phổ biến, có mặt ở khắp nơi  ",
        partOfSpeech: "  adjective  ",
        phonetic: "  /juːˈbɪk.wə.təs/  ",
        topicId: "  topic-123  "
      });

      expect(addDoc).toHaveBeenCalledWith("collection:vocabularies", {
        word: "ubiquitous",
        definition: "phổ biến, có mặt ở khắp nơi",
        partOfSpeech: "adjective",
        phonetic: "/juːˈbɪk.wə.təs/",
        topicId: "topic-123",
        userId: "user-123",
        createdAt: "SERVER_TIMESTAMP",
        updatedAt: "SERVER_TIMESTAMP",
        level: 0,
        nextReview: "SERVER_TIMESTAMP",
        srsVersion: 1,
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0,
        lapses: 0,
        lastReviewedAt: null
      });
      expect(result).toBe("vocab-1");
    });

    it("converts empty topicId to null", async () => {
      vi.mocked(addDoc).mockResolvedValueOnce({ id: "vocab-2" } as any);

      await createVocabulary("user-123", {
        word: "hello",
        definition: "xin chào",
        topicId: "   "
      });

      expect(addDoc).toHaveBeenCalledWith(
        "collection:vocabularies",
        expect.objectContaining({
          topicId: null,
          partOfSpeech: "",
          phonetic: ""
        })
      );
    });

    it("logs error and re-throws when addDoc fails", async () => {
      const error = new Error("Firestore permission denied");
      vi.mocked(addDoc).mockRejectedValueOnce(error);

      await expect(
        createVocabulary("user-123", {
          word: "hello",
          definition: "xin chào"
        })
      ).rejects.toThrow("Firestore permission denied");

      expect(handleFirestoreError).toHaveBeenCalledWith(error, "create", "vocabularies");
    });
  });

  describe("updateVocabulary", () => {
    it("normalizes updated fields and includes updatedAt timestamp", async () => {
      vi.mocked(updateDoc).mockResolvedValueOnce(undefined as any);

      await updateVocabulary("vocab-1", {
        word: "  diligent  ",
        definition: "  chăm chỉ  ",
        partOfSpeech: "  adj  ",
        phonetic: "  /ˈdɪl.ə.dʒənt/  ",
        topicId: "  "
      });

      expect(updateDoc).toHaveBeenCalledWith("doc:vocabularies/vocab-1", {
        word: "diligent",
        definition: "chăm chỉ",
        partOfSpeech: "adj",
        phonetic: "/ˈdɪl.ə.dʒənt/",
        topicId: null,
        updatedAt: "SERVER_TIMESTAMP"
      });
    });

    it("logs error and re-throws when updateDoc fails", async () => {
      const error = new Error("Update error");
      vi.mocked(updateDoc).mockRejectedValueOnce(error);

      await expect(
        updateVocabulary("vocab-1", { word: "test", definition: "test" })
      ).rejects.toThrow("Update error");

      expect(handleFirestoreError).toHaveBeenCalledWith(error, "update", "vocabularies/vocab-1");
    });
  });

  describe("deleteVocabulary", () => {
    it("calls deleteDoc on the vocabulary reference", async () => {
      vi.mocked(deleteDoc).mockResolvedValueOnce(undefined as any);

      await deleteVocabulary("vocab-1");

      expect(deleteDoc).toHaveBeenCalledWith("doc:vocabularies/vocab-1");
    });

    it("logs error and re-throws when deleteDoc fails", async () => {
      const error = new Error("Delete error");
      vi.mocked(deleteDoc).mockRejectedValueOnce(error);

      await expect(deleteVocabulary("vocab-1")).rejects.toThrow("Delete error");
      expect(handleFirestoreError).toHaveBeenCalledWith(error, "delete", "vocabularies/vocab-1");
    });
  });

  describe("updateVocabularyReview", () => {
    it("persists SRS schedule calculation result with timestamps", async () => {
      vi.mocked(updateDoc).mockResolvedValueOnce(undefined as any);

      const nextReviewDate = new Date("2026-08-25T10:00:00Z");
      const schedule: ScheduleUpdate = {
        srsVersion: 1,
        intervalDays: 3,
        easeFactor: 2.65,
        repetitions: 2,
        lapses: 0,
        level: 2,
        nextReview: nextReviewDate,
        lastReviewedAt: new Date("2026-08-23T10:00:00Z")
      };

      await updateVocabularyReview("vocab-1", schedule);

      expect(updateDoc).toHaveBeenCalledWith("doc:vocabularies/vocab-1", {
        srsVersion: 1,
        intervalDays: 3,
        easeFactor: 2.65,
        repetitions: 2,
        lapses: 0,
        level: 2,
        nextReview: nextReviewDate,
        lastReviewedAt: "SERVER_TIMESTAMP",
        updatedAt: "SERVER_TIMESTAMP"
      });
    });

    it("logs error and re-throws when review update fails", async () => {
      const error = new Error("Review write failed");
      vi.mocked(updateDoc).mockRejectedValueOnce(error);

      const schedule: ScheduleUpdate = {
        srsVersion: 1,
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 1,
        lapses: 0,
        level: 1,
        nextReview: new Date(),
        lastReviewedAt: new Date()
      };

      await expect(updateVocabularyReview("vocab-1", schedule)).rejects.toThrow("Review write failed");
      expect(handleFirestoreError).toHaveBeenCalledWith(error, "update", "vocabularies/vocab-1");
    });
  });

  describe("recordVocabularyReview", () => {
    it("atomically batches updating vocabulary and creating reviewEvent", async () => {
      const vocab: Vocabulary = {
        id: "vocab-1",
        word: "apple",
        definition: "quả táo",
        partOfSpeech: "noun",
        phonetic: "/ˈæp.əl/",
        topicId: "topic-123",
        userId: "user-123",
        createdAt: new Date("2026-08-01"),
        updatedAt: new Date("2026-08-01"),
        level: 0,
        nextReview: new Date("2026-08-01"),
        srsVersion: 1,
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0,
        lapses: 0,
        lastReviewedAt: null
      };

      const nextReviewDate = new Date("2026-08-26T10:00:00Z");
      const schedule: ScheduleUpdate = {
        srsVersion: 1,
        intervalDays: 3,
        easeFactor: 2.5,
        repetitions: 2,
        lapses: 0,
        level: 2,
        nextReview: nextReviewDate,
        lastReviewedAt: new Date("2026-08-23T10:00:00Z")
      };

      await recordVocabularyReview({
        vocabulary: vocab,
        schedule,
        rating: "good",
        userId: "user-123"
      });

      expect(mockBatch.update).toHaveBeenCalledWith("doc:vocabularies/vocab-1", {
        srsVersion: 1,
        intervalDays: 3,
        easeFactor: 2.5,
        repetitions: 2,
        lapses: 0,
        level: 2,
        nextReview: nextReviewDate,
        lastReviewedAt: "SERVER_TIMESTAMP",
        updatedAt: "SERVER_TIMESTAMP"
      });

      expect(mockBatch.set).toHaveBeenCalledWith("doc:reviewEvents/generated-id", {
        userId: "user-123",
        vocabularyId: "vocab-1",
        rating: "good",
        previousLevel: 0,
        newLevel: 2,
        previousIntervalDays: 0,
        newIntervalDays: 3,
        topicId: "topic-123",
        srsVersion: 1,
        reviewedAt: "SERVER_TIMESTAMP"
      });

      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("handles batch commit failure and logs error", async () => {
      const error = new Error("Batch commit failed");
      mockBatch.commit.mockRejectedValueOnce(error);

      const vocab: Vocabulary = {
        id: "vocab-1",
        word: "apple",
        definition: "quả táo",
        partOfSpeech: "noun",
        phonetic: "",
        topicId: null,
        userId: "user-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        level: 0,
        nextReview: null
      };

      const schedule: ScheduleUpdate = {
        srsVersion: 1,
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 1,
        lapses: 0,
        level: 1,
        nextReview: new Date(),
        lastReviewedAt: new Date()
      };

      await expect(
        recordVocabularyReview({
          vocabulary: vocab,
          schedule,
          rating: "again",
          userId: "user-123"
        })
      ).rejects.toThrow("Batch commit failed");

      expect(handleFirestoreError).toHaveBeenCalledWith(
        error,
        "write",
        "vocabularies/vocab-1/reviewEvents"
      );
    });
  });


  describe("subscribeVocabularies", () => {
    it("subscribes and maps vocabularies from snapshot", () => {
      const mockUnsubscribe = vi.fn();
      let snapshotCallback: (snapshot: any) => void = () => {};

      vi.mocked(onSnapshot).mockImplementationOnce((_query, onNext: any) => {
        snapshotCallback = onNext;
        return mockUnsubscribe;
      });

      const onNext = vi.fn();
      const onError = vi.fn();

      const unsubscribe = subscribeVocabularies("user-123", onNext, onError);

      snapshotCallback({
        docs: [
          {
            id: "v1",
            data: () => ({ word: "hello", definition: "xin chào" })
          }
        ]
      });

      expect(onNext).toHaveBeenCalledWith([
        { id: "v1", word: "hello", definition: "xin chào" }
      ]);

      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it("handles errors during subscription", () => {
      let errorCallback: (error: any) => void = () => {};

      vi.mocked(onSnapshot).mockImplementationOnce((_query, _onNext: any, onError: any) => {
        errorCallback = onError;
        return vi.fn();
      });

      const onNext = vi.fn();
      const onError = vi.fn();

      subscribeVocabularies("user-123", onNext, onError);

      const error = new Error("Subscription failed");
      errorCallback(error);

      expect(handleFirestoreError).toHaveBeenCalledWith(error, "list", "vocabularies");
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});
