import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../api/ai/batch-details";
import { fetchBatchWordDetailsFromGemini } from "../api/lib/gemini";

const quotaMocks = vi.hoisted(() => ({
  createAiQuotaConsumer: vi.fn(),
  consume: vi.fn()
}));

vi.mock("../api/lib/googleCloud", () => ({
  createGoogleCloudAiQuotaConsumer: quotaMocks.createAiQuotaConsumer
}));

// Mock auth module
vi.mock("../api/lib/auth", () => ({
  verifyFirebaseIdToken: vi.fn(async (header: string | undefined) => {
    if (!header || !header.startsWith("Bearer ")) {
      throw new Error("Missing or invalid token");
    }
    const token = header.substring("Bearer ".length);
    if (token === "valid-token") {
      return { uid: "user-123", email: "user@example.com" };
    }
    throw new Error("Invalid token signature");
  })
}));

// Mock gemini module
vi.mock("../api/lib/gemini", () => ({
  fetchBatchWordDetailsFromGemini: vi.fn(async (words: string[]) => {
    if (words.includes("error")) {
      throw new Error("Gemini API internal error");
    }
    return words.map((w) => ({
      word: w,
      definition: `nghĩa của ${w}`,
      partOfSpeech: "noun",
      phonetic: `/${w}/`
    }));
  })
}));

function createMockReqRes(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  let statusCode = 200;
  let responseData: any = null;
  const headers: Record<string, any> = {};

  const req: any = {
    method: options.method || "POST",
    headers: options.headers || {},
    body: options.body
  };

  const res: any = {
    setHeader(name: string, value: any) {
      headers[name] = value;
      return res;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    _getStatus() {
      return statusCode;
    },
    _getData() {
      return responseData;
    },
    _getHeaders() {
      return headers;
    }
  };

  return { req, res };
}

describe("POST /api/ai/batch-details Serverless Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 405 Method Not Allowed for non-POST methods", async () => {
    const { req, res } = createMockReqRes({ method: "GET" });
    await handler(req, res);

    expect(res._getStatus()).toBe(405);
    expect(res._getData()).toEqual({ error: "Method Not Allowed" });
  });

  it("returns 401 Unauthorized when token is missing", async () => {
    const { req, res } = createMockReqRes({
      method: "POST",
      headers: {},
      body: { words: ["apple", "banana"] }
    });
    await handler(req, res);

    expect(res._getStatus()).toBe(401);
    expect(res._getData().error).toMatch(/Unauthorized/);
  });

  it("returns 400 Bad Request when words array is empty", async () => {
    const { req, res } = createMockReqRes({
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: { words: [] }
    });
    await handler(req, res);

    expect(res._getStatus()).toBe(400);
    expect(res._getData().error).toMatch(/Dữ liệu yêu cầu không hợp lệ/);
  });

  it("returns 400 Bad Request when words array exceeds 20 items", async () => {
    const words = Array.from({ length: 21 }, (_, i) => `word${i}`);
    const { req, res } = createMockReqRes({
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: { words }
    });
    await handler(req, res);

    expect(res._getStatus()).toBe(400);
    expect(res._getData().error).toMatch(/Dữ liệu yêu cầu không hợp lệ/);
  });

  it("returns 200 OK with array of enriched word details", async () => {
    const { req, res } = createMockReqRes({
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: { words: ["apple", "banana"] }
    });
    await handler(req, res);

    expect(res._getStatus()).toBe(200);
    expect(res._getData()).toEqual([
      {
        word: "apple",
        definition: "nghĩa của apple",
        partOfSpeech: "noun",
        phonetic: "/apple/"
      },
      {
        word: "banana",
        definition: "nghĩa của banana",
        partOfSpeech: "noun",
        phonetic: "/banana/"
      }
    ]);
  });

  it("returns 500 Internal Server Error when AI fails", async () => {
    const { req, res } = createMockReqRes({
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: { words: ["error"] }
    });
    await handler(req, res);

    expect(res._getStatus()).toBe(500);
    expect(res._getData().error).toMatch(/Không thể lấy thông tin từ AI/);
  });

  describe("per-user AI quota on Vercel", () => {
    const originalVercel = process.env.VERCEL;

    beforeEach(() => {
      process.env.VERCEL = "1";
      quotaMocks.createAiQuotaConsumer.mockResolvedValue(quotaMocks.consume);
      quotaMocks.consume.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    });

    afterEach(() => {
      if (originalVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = originalVercel;
    });

    it("charges the authenticated user 3 unit(s) before calling Gemini", async () => {
      const { req, res } = createMockReqRes({
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: { words: ["apple", "banana", "cherry"] }
      });
      await handler(req, res);

      expect(res._getStatus()).toBe(200);
      expect(quotaMocks.consume).toHaveBeenCalledWith("user-123", 3, expect.any(Date));
    });

    it("returns 429 with Retry-After and skips Gemini when the quota is exhausted", async () => {
      quotaMocks.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 125 });
      const { req, res } = createMockReqRes({
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: { words: ["apple", "banana", "cherry"] }
      });
      await handler(req, res);

      expect(res._getStatus()).toBe(429);
      expect(res._getHeaders()["Retry-After"]).toBe("125");
      expect(res._getData().error).toMatch(/300 từ.*3 phút/);
      expect(fetchBatchWordDetailsFromGemini).not.toHaveBeenCalled();
    });

    it("fails closed with 503 when the quota store is unavailable", async () => {
      quotaMocks.createAiQuotaConsumer.mockRejectedValue(new Error("GCP_PROJECT_ID is required"));
      const { req, res } = createMockReqRes({
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: { words: ["apple", "banana", "cherry"] }
      });
      await handler(req, res);

      expect(res._getStatus()).toBe(503);
      expect(fetchBatchWordDetailsFromGemini).not.toHaveBeenCalled();
    });

    it("does not charge quota for invalid requests", async () => {
      const { req, res } = createMockReqRes({
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: {}
      });
      await handler(req, res);

      expect(res._getStatus()).toBe(400);
      expect(quotaMocks.consume).not.toHaveBeenCalled();
    });
  });
});
