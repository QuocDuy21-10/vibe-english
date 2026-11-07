import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDoc, setDoc } from "firebase/firestore";
import {
  generateWordUsages,
  getWordUsage,
  isWordUsageStale,
  saveWordUsage
} from "@/services/wordUsageRepository";
import { getWordUsages } from "@/services/geminiService";
import type { Vocabulary, WordUsage } from "@/types/types";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, name, id) => `doc:${name}/${id}`),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP")
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/firestoreErrors", () => ({ handleFirestoreError: vi.fn() }));
vi.mock("@/services/geminiService", () => ({ getWordUsages: vi.fn() }));

const vocab = (overrides: Partial<Vocabulary> = {}): Vocabulary => ({
  id: "v1",
  word: "deploy",
  definition: "triển khai",
  partOfSpeech: "verb",
  phonetic: "",
  topicId: null,
  userId: "alice",
  createdAt: new Date(),
  updatedAt: new Date(),
  level: 0,
  nextReview: null,
  ...overrides
});

const content = {
  examples: [{ sentence: "We deployed it.", translation: "Đã triển khai.", answer: "deployed" }],
  collocations: [{ phrase: "deploy code", meaning: "triển khai mã" }]
};

describe("wordUsageRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no usage is cached", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as any);
    await expect(getWordUsage("v1")).resolves.toBeNull();
    expect(getDoc).toHaveBeenCalledWith("doc:wordUsages/v1");
  });

  it("returns the cached usage", async () => {
    const stored = { userId: "alice", vocabularyId: "v1", word: "deploy", generatedAt: new Date(), ...content };
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true, data: () => stored } as any);
    await expect(getWordUsage("v1")).resolves.toEqual(stored);
  });

  it("saves exactly the allowed keys with a server timestamp and capped sizes", async () => {
    vi.mocked(setDoc).mockResolvedValueOnce(undefined);
    const many = {
      examples: Array.from({ length: 7 }, () => ({ sentence: "s".repeat(400), translation: "t", answer: "a" })),
      collocations: Array.from({ length: 9 }, () => ({ phrase: "p", meaning: "m" }))
    };
    const saved = await saveWordUsage({ vocabulary: vocab(), userId: "alice", content: many });

    const [ref, payload] = vi.mocked(setDoc).mock.calls[0] as unknown as [string, any];
    expect(ref).toBe("doc:wordUsages/v1");
    expect(Object.keys(payload).sort()).toEqual(
      ["collocations", "examples", "generatedAt", "userId", "vocabularyId", "word"]
    );
    expect(payload.generatedAt).toBe("SERVER_TIMESTAMP");
    expect(payload.examples).toHaveLength(5);
    expect(payload.examples[0].sentence).toHaveLength(300);
    expect(payload.collocations).toHaveLength(8);
    expect(saved.generatedAt).toBeInstanceOf(Date);
  });

  it("detects a stale cache when the word was edited", () => {
    const usage = { word: "deploy" } as WordUsage;
    expect(isWordUsageStale(usage, vocab())).toBe(false);
    expect(isWordUsageStale(usage, vocab({ word: "deployment" }))).toBe(true);
  });

  it("generates usages in request order and saves each one", async () => {
    vi.mocked(getWordUsages).mockResolvedValueOnce([
      { word: "deploy", ...content },
      { word: "ship", examples: [], collocations: [] }
    ]);
    vi.mocked(setDoc).mockResolvedValue(undefined);

    const result = await generateWordUsages([vocab(), vocab({ id: "v2", word: "ship" })], "alice");

    expect(getWordUsages).toHaveBeenCalledWith([
      { word: "deploy", partOfSpeech: "verb", definition: "triển khai" },
      { word: "ship", partOfSpeech: "verb", definition: "triển khai" }
    ]);
    expect(result.map((usage) => usage.vocabularyId)).toEqual(["v1", "v2"]);
    expect(setDoc).toHaveBeenCalledTimes(2);
  });
});
