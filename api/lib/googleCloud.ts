import { createHash } from "node:crypto";
import { getVercelOidcToken } from "@vercel/oidc";
import {
  ExternalAccountClient,
  type BaseExternalAccountClient,
  type ExternalAccountClientOptions
} from "google-auth-library";
import { TestPushError, type OwnedNotificationDevice, type TestPushDependencies } from "./testPush.js";

const TEST_PUSH_RATE_LIMIT: FixedWindowPolicy = { windowMs: 15 * 60 * 1000, limit: 3 };
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export interface FixedWindowPolicy {
  windowMs: number;
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export type FixedWindowDecision =
  | { allowed: true; windowStartedAt: Date; nextCount: number }
  | { allowed: false; retryAfterSeconds: number };

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  timestampValue?: string;
};

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
};

type GoogleApiError = {
  response?: {
    status?: number;
    data?: {
      error?: {
        status?: string;
        details?: Array<{ errorCode?: string }>;
      };
    };
  };
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function asGoogleApiError(error: unknown): GoogleApiError {
  return typeof error === "object" && error !== null ? error as GoogleApiError : {};
}

function isNotFound(error: unknown): boolean {
  return asGoogleApiError(error).response?.status === 404;
}

function isTransactionConflict(error: unknown): boolean {
  const apiError = asGoogleApiError(error);
  return apiError.response?.status === 409
    || apiError.response?.data?.error?.status === "ABORTED";
}

function rateStateId(userId: string, installationId: string): string {
  return createHash("sha256").update(`${userId}:${installationId}`).digest("hex");
}

function documentUrl(projectId: string, databaseId: string, path: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}`
    + `/databases/${encodeURIComponent(databaseId)}/documents/${encodedPath}`;
}

function databaseUrl(projectId: string, databaseId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}`
    + `/databases/${encodeURIComponent(databaseId)}/documents`;
}

async function createAuthClient(): Promise<BaseExternalAccountClient> {
  const provider = requiredEnvironment("GCP_WORKLOAD_IDENTITY_PROVIDER");
  const serviceAccount = requiredEnvironment("GCP_TEST_PUSH_SERVICE_ACCOUNT");
  const audience = requiredEnvironment("GCP_OIDC_AUDIENCE");
  const options: ExternalAccountClientOptions = {
    type: "external_account",
    audience: `//iam.googleapis.com/${provider}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/`
      + `${encodeURIComponent(serviceAccount)}:generateAccessToken`,
    scopes: [CLOUD_PLATFORM_SCOPE],
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ audience })
    }
  };
  const client = ExternalAccountClient.fromJSON(options);
  if (!client) throw new Error("Unable to create Google external account client");
  return client;
}

async function getDocument(
  authClient: BaseExternalAccountClient,
  url: string,
  transaction?: string
): Promise<FirestoreDocument | null> {
  try {
    const response = await authClient.request<FirestoreDocument>({
      url,
      method: "GET",
      params: transaction ? { transaction } : undefined
    });
    return response.data;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function parseDevice(
  document: FirestoreDocument | null,
  userId: string,
  installationId: string
): OwnedNotificationDevice | null {
  const storedUserId = document?.fields?.userId?.stringValue;
  const token = document?.fields?.token?.stringValue;
  if (!document || storedUserId !== userId || !token || !document.updateTime) return null;
  return { userId, installationId, token, updateTime: document.updateTime };
}

async function beginTransaction(
  authClient: BaseExternalAccountClient,
  baseUrl: string
): Promise<string> {
  const response = await authClient.request<{ transaction: string }>({
    url: `${baseUrl}:beginTransaction`,
    method: "POST",
    data: { options: { readWrite: {} } }
  });
  return response.data.transaction;
}

async function rollbackTransaction(
  authClient: BaseExternalAccountClient,
  baseUrl: string,
  transaction: string
): Promise<void> {
  await authClient.request({
    url: `${baseUrl}:rollback`,
    method: "POST",
    data: { transaction }
  });
}

export function evaluateFixedWindow(
  stored: { windowStartedAt?: string; count?: string } | undefined,
  now: Date,
  policy: FixedWindowPolicy,
  cost: number
): FixedWindowDecision {
  const parsedStart = stored?.windowStartedAt ? new Date(stored.windowStartedAt) : null;
  const elapsedMs = parsedStart && !Number.isNaN(parsedStart.getTime())
    ? now.getTime() - parsedStart.getTime()
    : Number.POSITIVE_INFINITY;
  const withinWindow = elapsedMs < policy.windowMs;
  const storedCount = Number.parseInt(stored?.count ?? "0", 10);
  const currentCount = withinWindow && Number.isFinite(storedCount) ? storedCount : 0;

  if (currentCount + cost > policy.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((policy.windowMs - (withinWindow ? elapsedMs : 0)) / 1000)
      )
    };
  }
  return {
    allowed: true,
    windowStartedAt: withinWindow && parsedStart ? parsedStart : now,
    nextCount: currentCount + cost
  };
}

async function consumeFixedWindowTransaction(
  authClient: BaseExternalAccountClient,
  baseUrl: string,
  stateDocumentUrl: string,
  stateDocumentName: string,
  now: Date,
  policy: FixedWindowPolicy,
  cost: number
): Promise<RateLimitResult> {
  const transaction = await beginTransaction(authClient, baseUrl);
  const document = await getDocument(authClient, stateDocumentUrl, transaction);
  const decision = evaluateFixedWindow(
    {
      windowStartedAt: document?.fields?.windowStartedAt?.timestampValue,
      count: document?.fields?.count?.integerValue
    },
    now,
    policy,
    cost
  );
  if (decision.allowed === false) {
    await rollbackTransaction(authClient, baseUrl, transaction);
    return { allowed: false, retryAfterSeconds: decision.retryAfterSeconds };
  }

  await authClient.request({
    url: `${baseUrl}:commit`,
    method: "POST",
    data: {
      transaction,
      writes: [{
        update: {
          name: stateDocumentName,
          fields: {
            windowStartedAt: { timestampValue: decision.windowStartedAt.toISOString() },
            count: { integerValue: String(decision.nextCount) },
            lastAttemptAt: { timestampValue: now.toISOString() }
          }
        },
        updateMask: { fieldPaths: ["windowStartedAt", "count", "lastAttemptAt"] }
      }]
    }
  });
  return { allowed: true, retryAfterSeconds: 0 };
}

interface FirestoreContext {
  authClient: BaseExternalAccountClient;
  projectId: string;
  databaseId: string;
  baseUrl: string;
}

async function createFirestoreContext(): Promise<FirestoreContext> {
  const projectId = requiredEnvironment("GCP_PROJECT_ID");
  const databaseId = requiredEnvironment("FIRESTORE_DATABASE_ID");
  if (databaseId === "(default)") throw new Error("Named Firestore database is required");
  const authClient = await createAuthClient();
  return { authClient, projectId, databaseId, baseUrl: databaseUrl(projectId, databaseId) };
}

async function consumeFixedWindow(
  context: FirestoreContext,
  statePath: string,
  now: Date,
  policy: FixedWindowPolicy,
  cost: number
): Promise<RateLimitResult> {
  const { authClient, projectId, databaseId, baseUrl } = context;
  const stateUrl = documentUrl(projectId, databaseId, statePath);
  const stateName = `projects/${projectId}/databases/${databaseId}/documents/${statePath}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await consumeFixedWindowTransaction(
        authClient,
        baseUrl,
        stateUrl,
        stateName,
        now,
        policy,
        cost
      );
    } catch (error) {
      if (!isTransactionConflict(error) || attempt === 4) throw error;
    }
  }
  throw new Error("Unable to commit rate limit transaction");
}

export async function createGoogleCloudAiQuotaConsumer(
  policy: FixedWindowPolicy
): Promise<(userId: string, cost: number, now: Date) => Promise<RateLimitResult>> {
  const context = await createFirestoreContext();
  return (userId, cost, now) => {
    const stateId = createHash("sha256").update(userId).digest("hex");
    return consumeFixedWindow(context, `aiUsageStates/${stateId}`, now, policy, cost);
  };
}

export async function createGoogleCloudTestPushDependencies(): Promise<TestPushDependencies> {
  const context = await createFirestoreContext();
  const { authClient, projectId, databaseId, baseUrl } = context;

  return {
    async getOwnedDevice(userId, installationId) {
      const document = await getDocument(
        authClient,
        documentUrl(projectId, databaseId, `notificationUsers/${userId}/devices/${installationId}`)
      );
      return parseDevice(document, userId, installationId);
    },

    async consumeRateLimit(userId, installationId, now) {
      const stateId = rateStateId(userId, installationId);
      return consumeFixedWindow(
        context,
        `notificationTestStates/${stateId}`,
        now,
        TEST_PUSH_RATE_LIMIT,
        1
      );
    },

    async sendMessage(input) {
      try {
        const response = await authClient.request<{ name: string }>({
          url: `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
          method: "POST",
          data: {
            message: {
              token: input.token,
              data: input.data,
              webpush: { headers: { Urgency: "normal" } }
            }
          }
        });
        return { messageId: response.data.name };
      } catch (error) {
        const details = asGoogleApiError(error).response?.data?.error?.details ?? [];
        const errorCode = details.find((detail) => detail.errorCode)?.errorCode;
        if (errorCode === "UNREGISTERED" || errorCode === "INVALID_ARGUMENT") {
          throw new TestPushError(
            "DEVICE_TOKEN_INVALID",
            410,
            "Đăng ký FCM của thiết bị không còn hợp lệ."
          );
        }
        throw new TestPushError(
          "FCM_REJECTED",
          502,
          "FCM không chấp nhận thông báo thử. Vui lòng thử lại."
        );
      }
    },

    async deleteDeviceIfUnchanged(device) {
      const url = documentUrl(
        projectId,
        databaseId,
        `notificationUsers/${device.userId}/devices/${device.installationId}`
      );
      try {
        await authClient.request({
          url,
          method: "DELETE",
          params: { "currentDocument.updateTime": device.updateTime }
        });
      } catch (error) {
        if (!isNotFound(error) && asGoogleApiError(error).response?.status !== 409) throw error;
      }
    },

    async recordAccepted(userId, installationId, acceptedAt) {
      const stateId = rateStateId(userId, installationId);
      const statePath = `notificationTestStates/${stateId}`;
      await authClient.request({
        url: `${baseUrl}:commit`,
        method: "POST",
        data: {
          writes: [{
            update: {
              name: `projects/${projectId}/databases/${databaseId}/documents/${statePath}`,
              fields: { lastAcceptedAt: { timestampValue: acceptedAt.toISOString() } }
            },
            updateMask: { fieldPaths: ["lastAcceptedAt"] }
          }]
        }
      });
    },

    logError(context, errorCode) {
      console.error(JSON.stringify({
        event: "notification-test-error",
        context,
        errorCode: errorCode ?? "unknown"
      }));
    }
  };
}
