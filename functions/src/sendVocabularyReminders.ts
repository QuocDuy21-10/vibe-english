import { createHash } from "node:crypto";
import {
  formatVocabularyNotification,
  isInvalidRegistrationError,
  selectVocabularyForWindow,
  type DispatchMode,
  type DispatchSource,
  type NotificationVocabulary
} from "./notificationDomain";

const MAX_MULTICAST_TOKENS = 500;
const MAX_SEND_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1_000, 3_000];

const RETRYABLE_ERROR_CODES = new Set([
  "messaging/internal-error",
  "messaging/server-unavailable",
  "messaging/quota-exceeded",
  "messaging/unknown-error"
]);

export interface DispatchInvocation {
  mode: DispatchMode;
  source: DispatchSource;
  scheduledAt: Date;
  executedAt: Date;
  windowKey: string;
  runId: string;
}

export interface NotificationDeviceRecord {
  path: string;
  installationId: string;
  userId: string;
  token: string;
  updateTime: string;
}

export interface DispatchState {
  lastVocabularyId: string | null;
}

export type DeviceDeliveryStatus =
  | "ACCEPTED"
  | "INVALID"
  | "PERMANENT_FAILURE"
  | "RETRYABLE_FAILURE";

export interface DeviceDeliveryOutcome {
  installationId: string;
  status: DeviceDeliveryStatus;
  attempts: number;
  errorCategory: string | null;
}

export type WindowDispatchStatus = "PROCESSING" | "RETRYABLE" | "SENT" | "FAILED";

export interface WindowLeaseState {
  status: WindowDispatchStatus;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
}

export type WindowLeaseDecision = "acquired" | "busy" | "complete";

export interface VocabularyPushMessage {
  tokens: string[];
  data: {
    title: string;
    body: string;
    vocabularyId: string;
    word: string;
    url: string;
    kind: "vocabulary-reminder";
    messageId: string;
    windowKey: string;
  };
}

export interface BatchSendResult {
  responses: Array<{
    success: boolean;
    errorCode?: string;
  }>;
}

export interface WindowFinalizationCounts {
  accepted: number;
  failed: number;
  invalid: number;
  retryable: number;
}

export interface DispatchDependencies {
  listDevices(): Promise<NotificationDeviceRecord[]>;
  listVocabularies(userId: string): Promise<NotificationVocabulary[]>;
  getDispatchState(userId: string): Promise<DispatchState>;
  acquireWindowLease(
    userId: string,
    windowKey: string,
    vocabularyId: string,
    invocation: DispatchInvocation
  ): Promise<{ result: WindowLeaseDecision; vocabularyId: string }>;
  renewWindowLease(userId: string, windowKey: string, runId: string, now: Date): Promise<void>;
  listDeviceOutcomes(userId: string, windowKey: string): Promise<Record<string, DeviceDeliveryOutcome>>;
  recordDeviceOutcomes(
    userId: string,
    windowKey: string,
    outcomes: DeviceDeliveryOutcome[],
    now: Date
  ): Promise<void>;
  finalizeWindow(
    userId: string,
    windowKey: string,
    vocabularyId: string,
    status: WindowDispatchStatus,
    counts: WindowFinalizationCounts,
    invocation: DispatchInvocation,
    now: Date
  ): Promise<void>;
  sendBatch(message: VocabularyPushMessage): Promise<BatchSendResult>;
  deleteDeviceIfTokenMatches(device: NotificationDeviceRecord): Promise<void>;
  sleep(delayMs: number): Promise<void>;
  logError(context: string, errorCode?: string): void;
}

export interface DispatchSummary {
  windowKey: string;
  scheduledAt: string;
  executedAt: string;
  usersConsidered: number;
  usersWithVocabulary: number;
  usersAttempted: number;
  successfulDeviceSends: number;
  failedDeviceSends: number;
  invalidTokensRemoved: number;
  retryableFailures: number;
  durationMs: number;
}

export function evaluateWindowLease(
  existing: WindowLeaseState | null,
  now: Date,
  runId: string
): WindowLeaseDecision {
  if (!existing || existing.status === "RETRYABLE") return "acquired";
  if (existing.status === "SENT" || existing.status === "FAILED") return "complete";
  if (existing.leaseOwner === runId) return "acquired";
  if (!existing.leaseExpiresAt || existing.leaseExpiresAt.getTime() <= now.getTime()) {
    return "acquired";
  }
  return "busy";
}

function groupDevicesByUser(devices: NotificationDeviceRecord[]) {
  const grouped = new Map<string, NotificationDeviceRecord[]>();
  for (const device of devices) {
    const existing = grouped.get(device.userId) ?? [];
    existing.push(device);
    grouped.set(device.userId, existing);
  }
  return grouped;
}

function isRetryableError(code: string | undefined): boolean {
  return typeof code === "string" && RETRYABLE_ERROR_CODES.has(code);
}

function createMessageId(userId: string, windowKey: string): string {
  return createHash("sha256").update(`${userId}:${windowKey}`).digest("hex").slice(0, 32);
}

function summarizeOutcomes(outcomes: Iterable<DeviceDeliveryOutcome>): WindowFinalizationCounts {
  const counts: WindowFinalizationCounts = { accepted: 0, failed: 0, invalid: 0, retryable: 0 };
  for (const outcome of outcomes) {
    if (outcome.status === "ACCEPTED") counts.accepted += 1;
    else if (outcome.status === "INVALID") counts.invalid += 1;
    else if (outcome.status === "RETRYABLE_FAILURE") counts.retryable += 1;
    else counts.failed += 1;
  }
  return counts;
}

function createSummary(invocation: DispatchInvocation): DispatchSummary {
  return {
    windowKey: invocation.windowKey,
    scheduledAt: invocation.scheduledAt.toISOString(),
    executedAt: invocation.executedAt.toISOString(),
    usersConsidered: 0,
    usersWithVocabulary: 0,
    usersAttempted: 0,
    successfulDeviceSends: 0,
    failedDeviceSends: 0,
    invalidTokensRemoved: 0,
    retryableFailures: 0,
    durationMs: 0
  };
}

export async function runVocabularyReminderDispatch(
  dependencies: DispatchDependencies,
  invocation: DispatchInvocation
): Promise<DispatchSummary> {
  const startedAt = Date.now();
  const summary = createSummary(invocation);
  const devicesByUser = groupDevicesByUser(await dependencies.listDevices());
  summary.usersConsidered = devicesByUser.size;

  for (const [userId, devices] of devicesByUser) {
    const vocabularies = await dependencies.listVocabularies(userId);
    if (vocabularies.length === 0) continue;
    summary.usersWithVocabulary += 1;

    const state = await dependencies.getDispatchState(userId);
    const selectedVocabulary = selectVocabularyForWindow(
      vocabularies,
      userId,
      invocation.windowKey,
      state.lastVocabularyId
    );
    if (!selectedVocabulary) continue;

    if (invocation.mode === "dry-run") {
      summary.usersAttempted += 1;
      continue;
    }

    const lease = await dependencies.acquireWindowLease(
      userId,
      invocation.windowKey,
      selectedVocabulary.id,
      invocation
    );
    if (lease.result !== "acquired") continue;
    summary.usersAttempted += 1;

    const vocabulary = vocabularies.find((item) => item.id === lease.vocabularyId);
    if (!vocabulary) {
      dependencies.logError("leased vocabulary is no longer available", "vocabulary-not-found");
      await dependencies.finalizeWindow(
        userId,
        invocation.windowKey,
        lease.vocabularyId,
        "FAILED",
        { accepted: 0, failed: devices.length, invalid: 0, retryable: 0 },
        invocation,
        new Date()
      );
      summary.failedDeviceSends += devices.length;
      continue;
    }

    const storedOutcomes = await dependencies.listDeviceOutcomes(userId, invocation.windowKey);
    const outcomes = new Map<string, DeviceDeliveryOutcome>(Object.entries(storedOutcomes));
    let pending = devices.filter((device) => {
      const status = outcomes.get(device.installationId)?.status;
      return status !== "ACCEPTED" && status !== "INVALID" && status !== "PERMANENT_FAILURE";
    });
    const content = formatVocabularyNotification(vocabulary);

    for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS && pending.length > 0; attempt += 1) {
      const retryDevices: NotificationDeviceRecord[] = [];
      for (let start = 0; start < pending.length; start += MAX_MULTICAST_TOKENS) {
        const batch = pending.slice(start, start + MAX_MULTICAST_TOKENS);
        await dependencies.renewWindowLease(userId, invocation.windowKey, invocation.runId, new Date());
        let responses: BatchSendResult["responses"];
        try {
          const result = await dependencies.sendBatch({
            tokens: batch.map((device) => device.token),
            data: {
              title: content.title,
              body: content.body,
              vocabularyId: vocabulary.id,
              word: vocabulary.word.trim(),
              url: "/dictionary",
              kind: "vocabulary-reminder",
              messageId: createMessageId(userId, invocation.windowKey),
              windowKey: invocation.windowKey
            }
          });
          responses = result.responses;
        } catch (error) {
          dependencies.logError(
            "vocabulary reminder batch transport failed",
            error instanceof Error ? error.name : "unknown"
          );
          responses = batch.map(() => ({ success: false, errorCode: "transport-error" }));
        }

        const attemptOutcomes: DeviceDeliveryOutcome[] = [];
        for (let index = 0; index < batch.length; index += 1) {
          const device = batch[index];
          const response = responses[index] ?? {
            success: false,
            errorCode: "missing-fcm-response"
          };
          let outcome: DeviceDeliveryOutcome;
          if (response.success) {
            outcome = {
              installationId: device.installationId,
              status: "ACCEPTED",
              attempts: attempt,
              errorCategory: null
            };
          } else if (isInvalidRegistrationError(response.errorCode)) {
            try {
              await dependencies.deleteDeviceIfTokenMatches(device);
              outcome = {
                installationId: device.installationId,
                status: "INVALID",
                attempts: attempt,
                errorCategory: "invalid-token"
              };
            } catch (cleanupError) {
              dependencies.logError(
                "invalid vocabulary reminder token cleanup failed",
                cleanupError instanceof Error ? cleanupError.name : "unknown"
              );
              outcome = {
                installationId: device.installationId,
                status: "PERMANENT_FAILURE",
                attempts: attempt,
                errorCategory: "invalid-token-cleanup-failed"
              };
            }
          } else if (response.errorCode === "transport-error" || isRetryableError(response.errorCode)) {
            outcome = {
              installationId: device.installationId,
              status: "RETRYABLE_FAILURE",
              attempts: attempt,
              errorCategory: response.errorCode ?? "unknown"
            };
            retryDevices.push(device);
          } else {
            outcome = {
              installationId: device.installationId,
              status: "PERMANENT_FAILURE",
              attempts: attempt,
              errorCategory: response.errorCode ?? "unknown"
            };
            dependencies.logError("vocabulary reminder device rejected", response.errorCode);
          }
          outcomes.set(device.installationId, outcome);
          attemptOutcomes.push(outcome);
        }
        await dependencies.recordDeviceOutcomes(
          userId,
          invocation.windowKey,
          attemptOutcomes,
          new Date()
        );
      }
      pending = retryDevices;
      if (pending.length > 0 && attempt < MAX_SEND_ATTEMPTS) {
        await dependencies.sleep(RETRY_DELAYS_MS[attempt - 1]);
      }
    }

    const counts = summarizeOutcomes(outcomes.values());
    const status: WindowDispatchStatus = counts.retryable > 0
      ? "RETRYABLE"
      : counts.accepted > 0
        ? "SENT"
        : "FAILED";
    await dependencies.finalizeWindow(
      userId,
      invocation.windowKey,
      vocabulary.id,
      status,
      counts,
      invocation,
      new Date()
    );

    summary.successfulDeviceSends += counts.accepted;
    summary.invalidTokensRemoved += counts.invalid;
    summary.retryableFailures += counts.retryable;
    summary.failedDeviceSends += counts.failed + counts.retryable;
  }

  summary.durationMs = Date.now() - startedAt;
  return summary;
}
