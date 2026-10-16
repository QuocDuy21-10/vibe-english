import { randomUUID } from "node:crypto";

export type TestPushErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "DEVICE_NOT_FOUND"
  | "DEVICE_TOKEN_INVALID"
  | "RATE_LIMITED"
  | "CREDENTIALS_UNAVAILABLE"
  | "FCM_REJECTED"
  | "INTERNAL_ERROR";

export class TestPushError extends Error {
  constructor(
    public readonly code: TestPushErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "TestPushError";
  }
}

export interface OwnedNotificationDevice {
  userId: string;
  installationId: string;
  token: string;
  updateTime: string;
}

export interface TestPushDependencies {
  getOwnedDevice(userId: string, installationId: string): Promise<OwnedNotificationDevice | null>;
  consumeRateLimit(
    userId: string,
    installationId: string,
    now: Date
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  sendMessage(input: {
    token: string;
    data: Record<string, string>;
  }): Promise<{ messageId: string }>;
  deleteDeviceIfUnchanged(device: OwnedNotificationDevice): Promise<void>;
  recordAccepted(userId: string, installationId: string, acceptedAt: Date): Promise<void>;
  logError(context: string, errorCode?: string): void;
}

export interface TestPushAccepted {
  ok: true;
  status: "accepted";
  messageId: string;
  acceptedAt: string;
}

export async function sendTestPush(
  dependencies: TestPushDependencies,
  input: { userId: string; installationId: string; now: Date }
): Promise<TestPushAccepted> {
  const device = await dependencies.getOwnedDevice(input.userId, input.installationId);
  if (!device || device.userId !== input.userId || device.installationId !== input.installationId) {
    throw new TestPushError(
      "DEVICE_NOT_FOUND",
      404,
      "Không tìm thấy đăng ký thông báo của thiết bị hiện tại."
    );
  }

  const rateLimit = await dependencies.consumeRateLimit(
    input.userId,
    input.installationId,
    input.now
  );
  if (!rateLimit.allowed) {
    throw new TestPushError(
      "RATE_LIMITED",
      429,
      "Bạn đã gửi quá nhiều thông báo thử. Vui lòng thử lại sau.",
      rateLimit.retryAfterSeconds
    );
  }

  let result: { messageId: string };
  try {
    result = await dependencies.sendMessage({
      token: device.token,
      data: {
        title: "🔔 Kiểm tra thông báo Vocabloom",
        body: "Thông báo thử đã được gửi. Bạn có thể nhận nhắc từ vựng mỗi 2 giờ.",
        vocabularyId: "",
        word: "",
        url: "/dashboard",
        kind: "notification-test",
        messageId: randomUUID()
      }
    });
  } catch (error) {
    if (error instanceof TestPushError && error.code === "DEVICE_TOKEN_INVALID") {
      try {
        await dependencies.deleteDeviceIfUnchanged(device);
      } catch (cleanupError) {
        dependencies.logError(
          "invalid token cleanup failed",
          cleanupError instanceof Error ? cleanupError.name : "unknown"
        );
      }
      throw error;
    }
    if (error instanceof TestPushError) throw error;
    throw new TestPushError(
      "FCM_REJECTED",
      502,
      "FCM không chấp nhận thông báo thử. Vui lòng thử lại."
    );
  }

  try {
    await dependencies.recordAccepted(input.userId, input.installationId, input.now);
  } catch (error) {
    dependencies.logError(
      "test push accepted tracking failed",
      error instanceof Error ? error.name : "unknown"
    );
  }
  return {
    ok: true,
    status: "accepted",
    messageId: result.messageId,
    acceptedAt: input.now.toISOString()
  };
}
