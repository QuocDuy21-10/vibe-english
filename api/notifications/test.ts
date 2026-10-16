import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { verifyFirebaseIdToken } from "../lib/auth.js";
import { createGoogleCloudTestPushDependencies } from "../lib/googleCloud.js";
import { sendTestPush, TestPushError, type TestPushErrorCode } from "../lib/testPush.js";

const requestSchema = z.object({
  installationId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/)
}).strict();

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function safeDiagnosticCode(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value)
    ? value
    : undefined;
}

function summarizeUnexpectedTestPushError(error: unknown) {
  const errorRecord = asRecord(error);
  const response = asRecord(errorRecord?.response);
  const responseData = asRecord(response?.data);
  const errorName = safeDiagnosticCode(errorRecord?.name) ?? "unknown";
  const isVercelOidcExchange = errorName === "VercelOidcTokenError"
    || (typeof errorRecord?.message === "string"
      && errorRecord.message.startsWith("Failed to exchange token:"));
  return {
    event: "notification-test-error",
    context: "send-test-push",
    name: errorName,
    ...(safeDiagnosticCode(errorRecord?.code) ? { code: safeDiagnosticCode(errorRecord?.code) } : {}),
    ...(typeof response?.status === "number" ? { httpStatus: response.status } : {}),
    ...(safeDiagnosticCode(responseData?.error)
      ? { apiError: safeDiagnosticCode(responseData?.error) }
      : {}),
    ...(isVercelOidcExchange ? { source: "vercel-oidc-exchange" } : {})
  };
}

function errorResponse(
  res: VercelResponse,
  statusCode: number,
  code: TestPushErrorCode,
  message: string,
  retryAfterSeconds?: number
) {
  if (retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(retryAfterSeconds));
  }
  return res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {})
    }
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return errorResponse(res, 405, "INVALID_REQUEST", "Method Not Allowed");
  }

  let authUser: Awaited<ReturnType<typeof verifyFirebaseIdToken>>;
  try {
    authUser = await verifyFirebaseIdToken(req.headers.authorization);
  } catch {
    return errorResponse(res, 401, "UNAUTHORIZED", "Yêu cầu đăng nhập hợp lệ.");
  }

  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body) as unknown;
    } catch {
      return errorResponse(res, 400, "INVALID_REQUEST", "Dữ liệu yêu cầu không hợp lệ.");
    }
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(res, 400, "INVALID_REQUEST", "Dữ liệu yêu cầu không hợp lệ.");
  }

  let dependencies: Awaited<ReturnType<typeof createGoogleCloudTestPushDependencies>>;
  try {
    dependencies = await createGoogleCloudTestPushDependencies();
  } catch (error) {
    console.error("Test push credentials unavailable", error instanceof Error ? error.name : "unknown");
    return errorResponse(
      res,
      503,
      "CREDENTIALS_UNAVAILABLE",
      "Backend chưa được cấu hình quyền gửi thông báo."
    );
  }

  try {
    const result = await sendTestPush(dependencies, {
      userId: authUser.uid,
      installationId: parsed.data.installationId,
      now: new Date()
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof TestPushError) {
      return errorResponse(
        res,
        error.statusCode,
        error.code,
        error.message,
        error.retryAfterSeconds
      );
    }
    console.error(JSON.stringify(summarizeUnexpectedTestPushError(error)));
    return errorResponse(res, 500, "INTERNAL_ERROR", "Không thể gửi thông báo thử lúc này.");
  }
}
