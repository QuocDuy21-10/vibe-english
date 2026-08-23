import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWordDetails } from "../src/services/geminiService";

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
});
