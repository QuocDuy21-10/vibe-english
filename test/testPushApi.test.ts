import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mocks = vi.hoisted(() => ({
  verifyFirebaseIdToken: vi.fn(),
  createDependencies: vi.fn()
}));

vi.mock("../api/lib/auth", () => ({
  verifyFirebaseIdToken: mocks.verifyFirebaseIdToken
}));

vi.mock("../api/lib/googleCloud", () => ({
  createGoogleCloudTestPushDependencies: mocks.createDependencies
}));

import handler from "../api/notifications/test";
import {
  sendTestPush,
  TestPushError,
  type TestPushDependencies
} from "../api/lib/testPush";

type ResponseCapture = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string | number | readonly string[]>;
};

function createRequestResponse(options: {
  method?: string;
  authorization?: string;
  body?: unknown;
}) {
  const capture: ResponseCapture = { statusCode: 200, body: null, headers: {} };
  const request = {
    method: options.method ?? "POST",
    headers: options.authorization ? { authorization: options.authorization } : {},
    body: options.body
  } as VercelRequest;
  const response = {
    setHeader(name: string, value: string | number | readonly string[]) {
      capture.headers[name] = value;
      return response;
    },
    status(statusCode: number) {
      capture.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      capture.body = body;
      return response;
    }
  } as unknown as VercelResponse;
  return { request, response, capture };
}

function createDependencies(overrides: Partial<TestPushDependencies> = {}): TestPushDependencies {
  return {
    async getOwnedDevice(userId, installationId) {
      return {
        userId,
        installationId,
        token: "sensitive-fcm-token",
        updateTime: "2026-10-15T00:00:00.000Z"
      };
    },
    async consumeRateLimit() {
      return { allowed: true, retryAfterSeconds: 0 };
    },
    async sendMessage() {
      return { messageId: "projects/project/messages/message-1" };
    },
    async deleteDeviceIfUnchanged() {
      return undefined;
    },
    async recordAccepted() {
      return undefined;
    },
    logError: vi.fn(),
    ...overrides
  };
}

describe("sendTestPush", () => {
  it("uses the verified UID and installation path without accepting a client token", async () => {
    const getOwnedDevice = vi.fn(createDependencies().getOwnedDevice);
    const dependencies = createDependencies({ getOwnedDevice });

    const result = await sendTestPush(dependencies, {
      userId: "verified-user",
      installationId: "installation_123",
      now: new Date("2026-10-15T01:00:00.000Z")
    });

    expect(getOwnedDevice).toHaveBeenCalledWith("verified-user", "installation_123");
    expect(result).toEqual({
      ok: true,
      status: "accepted",
      messageId: "projects/project/messages/message-1",
      acceptedAt: "2026-10-15T01:00:00.000Z"
    });
    expect(JSON.stringify(result)).not.toContain("sensitive-fcm-token");
  });

  it("rejects a missing current-device registration", async () => {
    const dependencies = createDependencies({
      async getOwnedDevice() {
        return null;
      }
    });

    await expect(sendTestPush(dependencies, {
      userId: "verified-user",
      installationId: "missing-device",
      now: new Date()
    })).rejects.toMatchObject({ code: "DEVICE_NOT_FOUND", statusCode: 404 });
  });

  it("rejects a registration whose stored owner does not match the verified UID", async () => {
    const dependencies = createDependencies({
      async getOwnedDevice() {
        return {
          userId: "another-user",
          installationId: "installation_123",
          token: "sensitive-fcm-token",
          updateTime: "2026-10-15T00:00:00.000Z"
        };
      }
    });

    await expect(sendTestPush(dependencies, {
      userId: "verified-user",
      installationId: "installation_123",
      now: new Date()
    })).rejects.toMatchObject({ code: "DEVICE_NOT_FOUND", statusCode: 404 });
  });

  it("returns a server-enforced retry interval when rate limited", async () => {
    const dependencies = createDependencies({
      async consumeRateLimit() {
        return { allowed: false, retryAfterSeconds: 420 };
      }
    });

    await expect(sendTestPush(dependencies, {
      userId: "verified-user",
      installationId: "installation_123",
      now: new Date()
    })).rejects.toMatchObject({
      code: "RATE_LIMITED",
      statusCode: 429,
      retryAfterSeconds: 420
    });
  });

  it("deletes only the unchanged registration when FCM rejects an invalid token", async () => {
    const deleteDeviceIfUnchanged = vi.fn();
    const dependencies = createDependencies({
      deleteDeviceIfUnchanged,
      async sendMessage() {
        throw new TestPushError("DEVICE_TOKEN_INVALID", 410, "Token invalid");
      }
    });

    await expect(sendTestPush(dependencies, {
      userId: "verified-user",
      installationId: "installation_123",
      now: new Date()
    })).rejects.toMatchObject({ code: "DEVICE_TOKEN_INVALID", statusCode: 410 });
    expect(deleteDeviceIfUnchanged).toHaveBeenCalledWith({
      userId: "verified-user",
      installationId: "installation_123",
      token: "sensitive-fcm-token",
      updateTime: "2026-10-15T00:00:00.000Z"
    });
  });

  it("preserves the invalid-token response when conditional cleanup fails", async () => {
    const logError = vi.fn();
    const dependencies = createDependencies({
      async sendMessage() {
        throw new TestPushError("DEVICE_TOKEN_INVALID", 410, "Token invalid");
      },
      async deleteDeviceIfUnchanged() {
        throw new Error("Firestore unavailable");
      },
      logError
    });

    await expect(sendTestPush(dependencies, {
      userId: "verified-user",
      installationId: "installation_123",
      now: new Date()
    })).rejects.toMatchObject({ code: "DEVICE_TOKEN_INVALID", statusCode: 410 });
    expect(logError).toHaveBeenCalledWith("invalid token cleanup failed", "Error");
  });

  it("maps an unknown FCM error without exposing its details", async () => {
    const dependencies = createDependencies({
      async sendMessage() {
        throw new Error("raw FCM response containing sensitive data");
      }
    });

    await expect(sendTestPush(dependencies, {
      userId: "verified-user",
      installationId: "installation_123",
      now: new Date()
    })).rejects.toMatchObject({
      code: "FCM_REJECTED",
      statusCode: 502,
      message: expect.not.stringContaining("sensitive")
    });
  });

  it("keeps an accepted result when delivery tracking fails afterward", async () => {
    const logError = vi.fn();
    const dependencies = createDependencies({
      async recordAccepted() {
        throw new Error("Firestore unavailable");
      },
      logError
    });

    await expect(sendTestPush(dependencies, {
      userId: "verified-user",
      installationId: "installation_123",
      now: new Date("2026-10-15T01:00:00.000Z")
    })).resolves.toMatchObject({ ok: true, status: "accepted" });
    expect(logError).toHaveBeenCalledWith("test push accepted tracking failed", "Error");
  });
});

describe("POST /api/notifications/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyFirebaseIdToken.mockResolvedValue({ uid: "verified-user" });
    mocks.createDependencies.mockResolvedValue(createDependencies());
  });

  it("allows POST only", async () => {
    const { request, response, capture } = createRequestResponse({ method: "GET" });
    await handler(request, response);

    expect(capture.statusCode).toBe(405);
    expect(capture.headers.Allow).toBe("POST");
  });

  it("returns UNAUTHORIZED for a missing or invalid Firebase ID token", async () => {
    mocks.verifyFirebaseIdToken.mockRejectedValue(new Error("invalid token"));
    const { request, response, capture } = createRequestResponse({
      body: { installationId: "installation_123" }
    });
    await handler(request, response);

    expect(capture.statusCode).toBe(401);
    expect(capture.body).toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED", message: expect.any(String) }
    });
  });

  it("returns INVALID_REQUEST for a malformed installation ID", async () => {
    const { request, response, capture } = createRequestResponse({
      authorization: "Bearer valid-token",
      body: { installationId: "../arbitrary/path" }
    });
    await handler(request, response);

    expect(capture.statusCode).toBe(400);
    expect(capture.body).toEqual({
      ok: false,
      error: { code: "INVALID_REQUEST", message: expect.any(String) }
    });
  });

  it("returns the accepted contract without sensitive data", async () => {
    const { request, response, capture } = createRequestResponse({
      authorization: "Bearer valid-token",
      body: { installationId: "installation_123" }
    });
    await handler(request, response);

    expect(capture.statusCode).toBe(200);
    expect(capture.body).toMatchObject({ ok: true, status: "accepted" });
    expect(JSON.stringify(capture.body)).not.toContain("sensitive-fcm-token");
  });

  it("returns Retry-After with a typed rate-limit response", async () => {
    mocks.createDependencies.mockResolvedValue(createDependencies({
      async consumeRateLimit() {
        return { allowed: false, retryAfterSeconds: 600 };
      }
    }));
    const { request, response, capture } = createRequestResponse({
      authorization: "Bearer valid-token",
      body: { installationId: "installation_123" }
    });
    await handler(request, response);

    expect(capture.statusCode).toBe(429);
    expect(capture.headers["Retry-After"]).toBe("600");
    expect(capture.body).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED", retryAfterSeconds: 600 }
    });
  });

  it("maps missing OIDC credentials without exposing their error details", async () => {
    mocks.createDependencies.mockRejectedValue(new Error("raw credential response"));
    const { request, response, capture } = createRequestResponse({
      authorization: "Bearer valid-token",
      body: { installationId: "installation_123" }
    });
    await handler(request, response);

    expect(capture.statusCode).toBe(503);
    expect(capture.body).toEqual({
      ok: false,
      error: { code: "CREDENTIALS_UNAVAILABLE", message: expect.any(String) }
    });
    expect(JSON.stringify(capture.body)).not.toContain("raw credential response");
  });
});
