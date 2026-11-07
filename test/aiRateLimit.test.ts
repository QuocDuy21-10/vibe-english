import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAiQuotaConsumer: vi.fn()
}));

vi.mock("../api/lib/googleCloud", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/lib/googleCloud")>()),
  createGoogleCloudAiQuotaConsumer: mocks.createAiQuotaConsumer
}));

import { evaluateFixedWindow } from "../api/lib/googleCloud";
import { AI_QUOTA_POLICY, consumeAiQuota } from "../api/lib/aiRateLimit";

const policy = { windowMs: 60 * 60 * 1000, limit: 300 };
const now = new Date("2026-11-07T10:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000).toISOString();

describe("evaluateFixedWindow", () => {
  it("opens a new window when there is no stored state", () => {
    expect(evaluateFixedWindow(undefined, now, policy, 20)).toEqual({
      allowed: true,
      windowStartedAt: now,
      nextCount: 20
    });
  });

  it("adds the cost inside the current window and keeps its start", () => {
    expect(evaluateFixedWindow({ windowStartedAt: minutesAgo(10), count: "100" }, now, policy, 20))
      .toEqual({ allowed: true, windowStartedAt: new Date(minutesAgo(10)), nextCount: 120 });
  });

  it("allows a request that lands exactly on the limit", () => {
    expect(evaluateFixedWindow({ windowStartedAt: minutesAgo(10), count: "280" }, now, policy, 20))
      .toMatchObject({ allowed: true, nextCount: 300 });
  });

  it("rejects a request that would exceed the limit and reports the remaining window", () => {
    expect(evaluateFixedWindow({ windowStartedAt: minutesAgo(10), count: "290" }, now, policy, 20))
      .toEqual({ allowed: false, retryAfterSeconds: 50 * 60 });
  });

  it("resets the count once the window has expired", () => {
    expect(evaluateFixedWindow({ windowStartedAt: minutesAgo(60), count: "300" }, now, policy, 1))
      .toEqual({ allowed: true, windowStartedAt: now, nextCount: 1 });
  });

  it("treats an unreadable stored state as a fresh window", () => {
    expect(evaluateFixedWindow({ windowStartedAt: "not-a-date", count: "abc" }, now, policy, 1))
      .toEqual({ allowed: true, windowStartedAt: now, nextCount: 1 });
    expect(evaluateFixedWindow({ windowStartedAt: minutesAgo(1), count: "abc" }, now, policy, 1))
      .toMatchObject({ allowed: true, nextCount: 1 });
  });

  it("keeps the test-push rule of 3 attempts per window", () => {
    const testPush = { windowMs: 15 * 60 * 1000, limit: 3 };
    expect(evaluateFixedWindow({ windowStartedAt: minutesAgo(1), count: "2" }, now, testPush, 1))
      .toMatchObject({ allowed: true, nextCount: 3 });
    expect(evaluateFixedWindow({ windowStartedAt: minutesAgo(1), count: "3" }, now, testPush, 1))
      .toEqual({ allowed: false, retryAfterSeconds: 14 * 60 });
  });
});

describe("consumeAiQuota", () => {
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it("skips the quota store outside Vercel (local dev)", async () => {
    delete process.env.VERCEL;
    await expect(consumeAiQuota("user-123", 5, now)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0
    });
    expect(mocks.createAiQuotaConsumer).not.toHaveBeenCalled();
  });

  it("charges the caller's quota on Vercel", async () => {
    process.env.VERCEL = "1";
    const consume = vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    mocks.createAiQuotaConsumer.mockResolvedValue(consume);

    await expect(consumeAiQuota("user-123", 5, now)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 42
    });
    expect(mocks.createAiQuotaConsumer).toHaveBeenCalledWith(AI_QUOTA_POLICY);
    expect(consume).toHaveBeenCalledWith("user-123", 5, now);
  });

  it("propagates quota store failures on Vercel so callers fail closed", async () => {
    process.env.VERCEL = "1";
    mocks.createAiQuotaConsumer.mockRejectedValue(new Error("GCP_PROJECT_ID is required"));
    await expect(consumeAiQuota("user-123", 1, now)).rejects.toThrow("GCP_PROJECT_ID is required");
  });
});
