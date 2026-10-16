import { describe, expect, it } from "vitest";
import {
  evaluateWindowLease,
  runVocabularyReminderDispatch,
  type DeviceDeliveryOutcome,
  type DispatchDependencies,
  type DispatchInvocation,
  type NotificationDeviceRecord,
  type VocabularyPushMessage,
  type WindowDispatchStatus
} from "../src/sendVocabularyReminders";
import type { NotificationVocabulary } from "../src/notificationDomain";

const SCHEDULED_AT = new Date("2026-10-13T01:00:00.000Z");
const EXECUTED_AT = new Date("2026-10-13T01:06:00.000Z");
const INVOCATION: DispatchInvocation = {
  mode: "live",
  source: "schedule",
  scheduledAt: SCHEDULED_AT,
  executedAt: EXECUTED_AT,
  windowKey: "2026-10-13-08",
  runId: "run-1"
};

const DEVICES: NotificationDeviceRecord[] = [
  {
    path: "notificationUsers/alice/devices/a1",
    installationId: "a1",
    userId: "alice",
    token: "token-a1",
    updateTime: "2026-10-13T00:00:00.000Z"
  },
  {
    path: "notificationUsers/alice/devices/a2",
    installationId: "a2",
    userId: "alice",
    token: "token-a2",
    updateTime: "2026-10-13T00:00:00.000Z"
  }
];

const VOCABULARIES: Record<string, NotificationVocabulary[]> = {
  alice: [{
    id: "a-word",
    word: "apple",
    phonetic: "/ˈæp.əl/",
    partOfSpeech: "noun",
    definition: "quả táo"
  }]
};

type FakeOptions = {
  devices?: NotificationDeviceRecord[];
  vocabularies?: Record<string, NotificationVocabulary[]>;
  leaseResult?: "acquired" | "busy" | "complete";
  leaseError?: Error;
  outcomes?: Record<string, DeviceDeliveryOutcome>;
  batchResults?: Array<
    | { responses: Array<{ success: boolean; errorCode?: string }> }
    | Error
  >;
  deleteError?: Error;
};

function createFakeDependencies(options: FakeOptions = {}) {
  const events: string[] = [];
  const sentMessages: VocabularyPushMessage[] = [];
  const recordedOutcomes: DeviceDeliveryOutcome[][] = [];
  const finalized: WindowDispatchStatus[] = [];
  const deleted: string[] = [];
  const sleeps: number[] = [];
  let sendIndex = 0;

  const dependencies: DispatchDependencies = {
    async listDevices() {
      events.push("list-devices");
      return options.devices ?? DEVICES;
    },
    async listVocabularies(userId) {
      events.push(`list-vocabularies:${userId}`);
      return options.vocabularies?.[userId] ?? VOCABULARIES[userId] ?? [];
    },
    async getDispatchState() {
      return { lastVocabularyId: null };
    },
    async acquireWindowLease(_userId, _windowKey, vocabularyId) {
      events.push("acquire-lease");
      if (options.leaseError) throw options.leaseError;
      return { result: options.leaseResult ?? "acquired", vocabularyId };
    },
    async renewWindowLease() {
      events.push("renew-lease");
    },
    async listDeviceOutcomes() {
      return options.outcomes ?? {};
    },
    async recordDeviceOutcomes(_userId, _windowKey, outcomes) {
      recordedOutcomes.push(outcomes);
      events.push(`record:${outcomes.map((item) => item.status).join(",")}`);
    },
    async finalizeWindow(_userId, _windowKey, _vocabularyId, status) {
      finalized.push(status);
      events.push(`finalize:${status}`);
    },
    async sendBatch(message) {
      sentMessages.push(message);
      events.push(`send:${message.tokens.join(",")}`);
      const configured = options.batchResults?.[sendIndex++];
      if (configured instanceof Error) throw configured;
      return configured ?? { responses: message.tokens.map(() => ({ success: true })) };
    },
    async deleteDeviceIfTokenMatches(device) {
      if (options.deleteError) throw options.deleteError;
      deleted.push(device.installationId);
    },
    async sleep(delayMs) {
      sleeps.push(delayMs);
    },
    logError() {
      events.push("log-error");
    }
  };

  return { dependencies, events, sentMessages, recordedOutcomes, finalized, deleted, sleeps };
}

describe("evaluateWindowLease", () => {
  it("blocks a different run while a processing lease is active", () => {
    expect(evaluateWindowLease({
      status: "PROCESSING",
      leaseOwner: "run-2",
      leaseExpiresAt: new Date("2026-10-13T01:10:00.000Z")
    }, EXECUTED_AT, "run-1")).toBe("busy");
  });

  it("recovers a processing window after its lease expires", () => {
    expect(evaluateWindowLease({
      status: "PROCESSING",
      leaseOwner: "run-2",
      leaseExpiresAt: new Date("2026-10-13T01:05:00.000Z")
    }, EXECUTED_AT, "run-1")).toBe("acquired");
  });

  it("does not reacquire a terminal window", () => {
    expect(evaluateWindowLease({
      status: "SENT",
      leaseOwner: null,
      leaseExpiresAt: null
    }, EXECUTED_AT, "run-1")).toBe("complete");
  });
});

describe("runVocabularyReminderDispatch", () => {
  it("skips a user with no vocabulary before acquiring a lease", async () => {
    const fake = createFakeDependencies({ vocabularies: { alice: [] } });
    const summary = await runVocabularyReminderDispatch(fake.dependencies, INVOCATION);

    expect(fake.events).toEqual(["list-devices", "list-vocabularies:alice"]);
    expect(summary.usersWithVocabulary).toBe(0);
    expect(summary.usersAttempted).toBe(0);
  });

  it("does not mutate or send during dry-run", async () => {
    const fake = createFakeDependencies();
    const summary = await runVocabularyReminderDispatch(fake.dependencies, {
      ...INVOCATION,
      mode: "dry-run"
    });

    expect(fake.events).toEqual(["list-devices", "list-vocabularies:alice"]);
    expect(fake.sentMessages).toEqual([]);
    expect(fake.recordedOutcomes).toEqual([]);
    expect(fake.finalized).toEqual([]);
    expect(summary.usersAttempted).toBe(1);
  });

  it("skips sending when another run owns the active lease", async () => {
    const fake = createFakeDependencies({ leaseResult: "busy" });
    const summary = await runVocabularyReminderDispatch(fake.dependencies, INVOCATION);

    expect(fake.sentMessages).toEqual([]);
    expect(fake.finalized).toEqual([]);
    expect(summary.usersAttempted).toBe(0);
  });

  it("propagates a Firestore lease transaction failure without sending", async () => {
    const fake = createFakeDependencies({ leaseError: new Error("transaction unavailable") });

    await expect(runVocabularyReminderDispatch(fake.dependencies, INVOCATION)).rejects.toThrow(
      "transaction unavailable"
    );
    expect(fake.sentMessages).toEqual([]);
  });

  it("does not resend a device already accepted in the same window", async () => {
    const fake = createFakeDependencies({
      outcomes: {
        a1: { installationId: "a1", status: "ACCEPTED", attempts: 1, errorCategory: null }
      }
    });
    const summary = await runVocabularyReminderDispatch(fake.dependencies, INVOCATION);

    expect(fake.sentMessages[0].tokens).toEqual(["token-a2"]);
    expect(summary.successfulDeviceSends).toBe(2);
    expect(fake.finalized).toEqual(["SENT"]);
  });

  it("retries only transient device failures and then records acceptance", async () => {
    const fake = createFakeDependencies({
      devices: [DEVICES[0]],
      batchResults: [
        { responses: [{ success: false, errorCode: "messaging/internal-error" }] },
        { responses: [{ success: true }] }
      ]
    });
    const summary = await runVocabularyReminderDispatch(fake.dependencies, INVOCATION);

    expect(fake.sentMessages).toHaveLength(2);
    expect(fake.sleeps).toEqual([1_000]);
    expect(fake.recordedOutcomes.flat().map((item) => item.status)).toEqual([
      "RETRYABLE_FAILURE",
      "ACCEPTED"
    ]);
    expect(summary.successfulDeviceSends).toBe(1);
    expect(summary.retryableFailures).toBe(0);
    expect(fake.finalized).toEqual(["SENT"]);
  });

  it("recovers from a transient batch transport error", async () => {
    const fake = createFakeDependencies({
      devices: [DEVICES[0]],
      batchResults: [new Error("network unavailable"), { responses: [{ success: true }] }]
    });
    const summary = await runVocabularyReminderDispatch(fake.dependencies, INVOCATION);

    expect(fake.sentMessages).toHaveLength(2);
    expect(fake.sleeps).toEqual([1_000]);
    expect(summary.successfulDeviceSends).toBe(1);
  });

  it("removes invalid tokens without affecting successful devices", async () => {
    const fake = createFakeDependencies({
      batchResults: [{ responses: [
        { success: true },
        { success: false, errorCode: "messaging/registration-token-not-registered" }
      ] }]
    });
    const summary = await runVocabularyReminderDispatch(fake.dependencies, INVOCATION);

    expect(fake.deleted).toEqual(["a2"]);
    expect(summary.successfulDeviceSends).toBe(1);
    expect(summary.invalidTokensRemoved).toBe(1);
    expect(summary.failedDeviceSends).toBe(0);
    expect(fake.finalized).toEqual(["SENT"]);
  });

  it("continues other devices when invalid-token cleanup fails", async () => {
    const fake = createFakeDependencies({
      deleteError: new Error("Firestore unavailable"),
      batchResults: [{ responses: [
        { success: false, errorCode: "messaging/registration-token-not-registered" },
        { success: true }
      ] }]
    });
    const summary = await runVocabularyReminderDispatch(fake.dependencies, INVOCATION);

    expect(summary.successfulDeviceSends).toBe(1);
    expect(summary.invalidTokensRemoved).toBe(0);
    expect(summary.failedDeviceSends).toBe(1);
    expect(fake.events).toContain("log-error");
    expect(fake.finalized).toEqual(["SENT"]);
  });

  it("marks a window retryable after three unresolved transient attempts", async () => {
    const transient = { responses: [{ success: false, errorCode: "messaging/server-unavailable" }] };
    const fake = createFakeDependencies({
      devices: [DEVICES[0]],
      batchResults: [transient, transient, transient]
    });
    const summary = await runVocabularyReminderDispatch(fake.dependencies, INVOCATION);

    expect(fake.sentMessages).toHaveLength(3);
    expect(fake.sleeps).toEqual([1_000, 3_000]);
    expect(summary.retryableFailures).toBe(1);
    expect(summary.failedDeviceSends).toBe(1);
    expect(fake.finalized).toEqual(["RETRYABLE"]);
  });

  it("marks a window failed when every device has a permanent rejection", async () => {
    const fake = createFakeDependencies({
      devices: [DEVICES[0]],
      batchResults: [{ responses: [
        { success: false, errorCode: "messaging/mismatched-credential" }
      ] }]
    });
    const summary = await runVocabularyReminderDispatch(fake.dependencies, INVOCATION);

    expect(summary.successfulDeviceSends).toBe(0);
    expect(summary.failedDeviceSends).toBe(1);
    expect(fake.finalized).toEqual(["FAILED"]);
  });

  it("builds a data-only message with the existing vocabulary content", async () => {
    const fake = createFakeDependencies({ devices: [DEVICES[0]] });
    await runVocabularyReminderDispatch(fake.dependencies, INVOCATION);

    expect(fake.sentMessages[0]).toEqual({
      tokens: ["token-a1"],
      data: {
        title: "Từ vựng: apple /ˈæp.əl/",
        body: "noun • quả táo",
        vocabularyId: "a-word",
        word: "apple",
        url: "/dictionary",
        kind: "vocabulary-reminder",
        messageId: expect.any(String),
        windowKey: "2026-10-13-08"
      }
    });
  });
});
