import { describe, it, expect, vi, beforeEach } from "vitest";
import { getBatchWordDetails, getWordDetails } from "../src/services/geminiService";

// Mock firebase auth
vi.mock("@/lib/firebase", () => ({
  auth: {
    currentUser: null
  }
}));

import { auth } from "@/lib/firebase";

describe("Client geminiService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as any).currentUser = null;
  });

  it("throws error when user is not logged in", async () => {
    (auth as any).currentUser = null;
    await expect(getWordDetails("hello")).rejects.toThrow(
      "Bạn cần đăng nhập để sử dụng tính năng tra từ AI."
    );
  });

  it("throws error when word is empty", async () => {
    await expect(getWordDetails("   ")).rejects.toThrow(
      "Vui lòng nhập từ tiếng Anh cần tra cứu."
    );
  });

  it("fetches word details with authorization header when user is logged in", async () => {
    const mockGetIdToken = vi.fn().mockResolvedValue("mock-token-123");
    (auth as any).currentUser = {
      getIdToken: mockGetIdToken
    };

    const mockResponseData = {
      word: "hello",
      definition: "xin chào",
      partOfSpeech: "noun",
      phonetic: "/həˈloʊ/"
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponseData
    }) as any;

    const result = await getWordDetails("hello");

    expect(mockGetIdToken).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/ai/word-details", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-token-123"
      },
      body: JSON.stringify({ word: "hello" })
    });
    expect(result).toEqual(mockResponseData);
  });

  it("throws error with server message when API returns non-200", async () => {
    (auth as any).currentUser = {
      getIdToken: vi.fn().mockResolvedValue("mock-token-123")
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Server rate limit exceeded" })
    }) as any;

    await expect(getWordDetails("hello")).rejects.toThrow(
      "Server rate limit exceeded"
    );
  });

  it("stops sending batch chunks after a 429 and keeps already-fetched results", async () => {
    (auth as any).currentUser = {
      getIdToken: vi.fn().mockResolvedValue("mock-token-123")
    };
    const words = Array.from({ length: 50 }, (_, i) => `word${i}`);
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => words.slice(0, 20).map((word) => ({
          word,
          definition: "nghĩa",
          partOfSpeech: "noun",
          phonetic: "/x/"
        }))
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: "Bạn đã tra quá 300 từ trong 1 giờ." })
      }) as any;
    const onProgress = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getBatchWordDetails(words, onProgress);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(50);
    expect(result[0].definition).toBe("nghĩa");
    expect(result.slice(20).every((item) => item.definition === "")).toBe(true);
    expect(onProgress).toHaveBeenLastCalledWith(50, 50);
    consoleError.mockRestore();
  });
});
