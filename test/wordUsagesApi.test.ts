import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../api/ai/word-usages";
import { fetchWordUsagesFromGemini } from "../api/lib/gemini";

const quotaMocks = vi.hoisted(() => ({
  createAiQuotaConsumer: vi.fn(),
  consume: vi.fn()
}));

vi.mock("../api/lib/googleCloud", () => ({
  createGoogleCloudAiQuotaConsumer: quotaMocks.createAiQuotaConsumer
}));

vi.mock("../api/lib/auth", () => ({
  verifyFirebaseIdToken: vi.fn(async (header: string | undefined) => {
    if (header === "Bearer valid-token") return { uid: "user-123" };
    throw new Error("Invalid token");
  })
}));

vi.mock("../api/lib/gemini", () => ({
  fetchWordUsagesFromGemini: vi.fn(async (items: { word: string }[]) => {
    if (items.some((item) => item.word === "error")) throw new Error("Gemini down");
    return items.map((item) => ({
      word: item.word,
      examples: [
        { sentence: `We ${item.word}ed it yesterday.`, translation: "Hôm qua chúng tôi đã làm.", answer: `${item.word}ed` },
        { sentence: "This sentence lacks the word.", translation: "Câu thiếu từ.", answer: item.word }
      ],
      collocations: [{ phrase: `${item.word} fast`, meaning: "nhanh" }]
    }));
  })
}));

function createMockReqRes(options: { method?: string; headers?: Record<string, string>; body?: any }) {
  let statusCode = 200;
  let responseData: any = null;
  const headers: Record<string, any> = {};
  const req: any = { method: options.method || "POST", headers: options.headers || {}, body: options.body };
  const res: any = {
    setHeader(name: string, value: any) { headers[name] = value; return res; },
    status(code: number) { statusCode = code; return res; },
    json(data: any) { responseData = data; return res; },
    _getStatus: () => statusCode,
    _getData: () => responseData,
    _getHeaders: () => headers
  };
  return { req, res };
}

const item = (word: string) => ({ word, partOfSpeech: "verb", definition: `nghĩa ${word}` });
const auth = { authorization: "Bearer valid-token" };

describe("POST /api/ai/word-usages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 405 for non-POST", async () => {
    const { req, res } = createMockReqRes({ method: "GET" });
    await handler(req, res);
    expect(res._getStatus()).toBe(405);
    expect(res._getHeaders().Allow).toBe("POST");
  });

  it("returns 401 without a valid token", async () => {
    const { req, res } = createMockReqRes({ body: { items: [item("deploy")] } });
    await handler(req, res);
    expect(res._getStatus()).toBe(401);
  });

  it("returns 400 for an empty item list", async () => {
    const { req, res } = createMockReqRes({ headers: auth, body: { items: [] } });
    await handler(req, res);
    expect(res._getStatus()).toBe(400);
  });

  it("returns 400 for more than 10 items", async () => {
    const items = Array.from({ length: 11 }, (_, i) => item(`w${i}`));
    const { req, res } = createMockReqRes({ headers: auth, body: { items } });
    await handler(req, res);
    expect(res._getStatus()).toBe(400);
  });

  it("returns 400 when a definition is too long", async () => {
    const { req, res } = createMockReqRes({
      headers: auth,
      body: { items: [{ word: "deploy", partOfSpeech: "verb", definition: "x".repeat(501) }] }
    });
    await handler(req, res);
    expect(res._getStatus()).toBe(400);
  });

  it("returns usages aligned to input and drops examples that do not contain the answer", async () => {
    const { req, res } = createMockReqRes({ headers: auth, body: { items: [item("deploy"), item("ship")] } });
    await handler(req, res);
    expect(res._getStatus()).toBe(200);
    const data = res._getData();
    expect(data.map((usage: any) => usage.word)).toEqual(["deploy", "ship"]);
    expect(data[0].examples).toEqual([
      { sentence: "We deployed it yesterday.", translation: "Hôm qua chúng tôi đã làm.", answer: "deployed" }
    ]);
    expect(data[0].collocations).toEqual([{ phrase: "deploy fast", meaning: "nhanh" }]);
  });

  it("returns 500 when Gemini fails", async () => {
    const { req, res } = createMockReqRes({ headers: auth, body: { items: [item("error")] } });
    await handler(req, res);
    expect(res._getStatus()).toBe(500);
    expect(res._getData().error).toMatch(/Không thể/);
  });

  describe("quota on Vercel", () => {
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

    it("charges one unit per item", async () => {
      const { req, res } = createMockReqRes({ headers: auth, body: { items: [item("a"), item("b")] } });
      await handler(req, res);
      expect(quotaMocks.consume).toHaveBeenCalledWith("user-123", 2, expect.any(Date));
    });

    it("returns 429 and skips Gemini when quota is exhausted", async () => {
      quotaMocks.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
      const { req, res } = createMockReqRes({ headers: auth, body: { items: [item("a")] } });
      await handler(req, res);
      expect(res._getStatus()).toBe(429);
      expect(fetchWordUsagesFromGemini).not.toHaveBeenCalled();
    });
  });
});
