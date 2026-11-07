// @vitest-environment jsdom

import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWordUsage: vi.fn(),
  generateWordUsages: vi.fn(),
  toastError: vi.fn()
}));

vi.mock("@/services/wordUsageRepository", () => ({
  getWordUsage: mocks.getWordUsage,
  generateWordUsages: mocks.generateWordUsages,
  isWordUsageStale: (usage: { word: string }, vocabulary: { word: string }) => usage.word !== vocabulary.word
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import { useWordUsages } from "@/hooks/useWordUsages";
import type { Vocabulary } from "@/types/types";

const vocab = (i: number) => ({ id: `v${i}`, word: `w${i}`, definition: "d", partOfSpeech: "" }) as Vocabulary;
const usageFor = (v: Vocabulary) => ({ userId: "u", vocabularyId: v.id, word: v.word, generatedAt: new Date(), examples: [], collocations: [] });

afterEach(() => vi.clearAllMocks());

describe("useWordUsages", () => {
  it("does nothing while disabled", () => {
    renderHook(() => useWordUsages([vocab(1)], false, "u"));
    expect(mocks.getWordUsage).not.toHaveBeenCalled();
  });

  it("uses the cache and generates missing words in chunks of 10", async () => {
    const vocabs = Array.from({ length: 12 }, (_, i) => vocab(i));
    mocks.getWordUsage.mockImplementation(async (id: string) => (id === "v0" ? usageFor(vocabs[0]) : null));
    mocks.generateWordUsages.mockImplementation(async (chunk: Vocabulary[]) => chunk.map(usageFor));

    const { result } = renderHook(() => useWordUsages(vocabs, true, "u"));

    await waitFor(() => expect(Object.values(result.current.states).every((s) => s.status === "ready")).toBe(true));
    expect(mocks.generateWordUsages).toHaveBeenCalledTimes(2);
    expect(mocks.generateWordUsages.mock.calls[0][0]).toHaveLength(10);
    expect(mocks.generateWordUsages.mock.calls[1][0]).toHaveLength(1);
  });

  it("marks the failed chunk and all later words as error, toasts once, and can retry one word", async () => {
    const vocabs = Array.from({ length: 11 }, (_, i) => vocab(i));
    mocks.getWordUsage.mockResolvedValue(null);
    mocks.generateWordUsages.mockRejectedValueOnce(new Error("quota"));

    const { result } = renderHook(() => useWordUsages(vocabs, true, "u"));

    await waitFor(() => expect(result.current.states.v10?.status).toBe("error"));
    expect(result.current.states.v0.status).toBe("error");
    expect(mocks.generateWordUsages).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).toHaveBeenCalledTimes(1);

    mocks.generateWordUsages.mockResolvedValueOnce([usageFor(vocabs[3])]);
    act(() => result.current.retry(vocabs[3]));
    await waitFor(() => expect(result.current.states.v3.status).toBe("ready"));
    expect(mocks.generateWordUsages).toHaveBeenLastCalledWith([vocabs[3]], "u");
  });
});
