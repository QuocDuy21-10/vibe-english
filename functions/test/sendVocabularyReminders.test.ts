import { describe, expect, it } from "vitest";
import {
  runVocabularyReminderDispatch,
  type DispatchDependencies,
  type NotificationDeviceRecord,
  type VocabularyPushMessage
} from "../src/sendVocabularyReminders";
import type { NotificationVocabulary } from "../src/notificationDomain";

const ACTIVE_TIME = new Date("2026-10-13T01:00:00.000Z");

type FakeOptions = {
  devices?: NotificationDeviceRecord[];
  vocabularies?: Record<string, NotificationVocabulary[]>;
  alreadyClaimedUsers?: string[];
  previousIds?: Record<string, string | null>;
  responses?: Array<{ success: boolean; errorCode?: string }>;
};

function createFakeDependencies(options: FakeOptions = {}) {
  const events: string[] = [];
  const vocabularyReads: string[] = [];
  const sentMessages: VocabularyPushMessage[] = [];
  const deletedPaths: string[] = [];

  const dependencies: DispatchDependencies = {
    async listDevices() {
      events.push("list-devices");
      return options.devices ?? [];
    },
    async listVocabularies(userId) {
      events.push(`list-vocabularies:${userId}`);
      vocabularyReads.push(userId);
      return options.vocabularies?.[userId] ?? [];
    },
    async getDispatchState(userId) {
      events.push(`get-state:${userId}`);
      return {
        lastWindowKey: null,
        lastVocabularyId: options.previousIds?.[userId] ?? null
      };
    },
    async claimWindow(userId) {
      events.push(`claim:${userId}`);
      return !(options.alreadyClaimedUsers ?? []).includes(userId);
    },
    async sendBatch(message) {
      events.push(`send:${message.tokens.join(",")}`);
      sentMessages.push(message);
      return {
        responses: options.responses ?? message.tokens.map(() => ({ success: true }))
      };
    },
    async deleteDevice(path) {
      events.push(`delete:${path}`);
      deletedPaths.push(path);
    },
    logError() {
      events.push("log-error");
    }
  };

  return { dependencies, events, vocabularyReads, sentMessages, deletedPaths };
}

const DEVICES: NotificationDeviceRecord[] = [
  { path: "notificationUsers/alice/devices/a1", userId: "alice", token: "token-a1" },
  { path: "notificationUsers/alice/devices/a2", userId: "alice", token: "token-a2" },
  { path: "notificationUsers/bob/devices/b1", userId: "bob", token: "token-b1" }
];

const VOCABULARIES: Record<string, NotificationVocabulary[]> = {
  alice: [
    { id: "a-word", word: "apple", phonetic: "/ˈæp.əl/", partOfSpeech: "noun", definition: "quả táo" }
  ],
  bob: [
    { id: "b-word", word: "brave", phonetic: "/breɪv/", partOfSpeech: "adjective", definition: "dũng cảm" }
  ]
};

describe("runVocabularyReminderDispatch", () => {
  it("does no work outside the daytime two-hour schedule", async () => {
    const fake = createFakeDependencies({ devices: DEVICES, vocabularies: VOCABULARIES });

    const result = await runVocabularyReminderDispatch(fake.dependencies, new Date("2026-10-13T14:00:00.000Z"));

    expect(result).toEqual({ usersConsidered: 0, usersSent: 0, devicesSent: 0, devicesRemoved: 0 });
    expect(fake.events).toEqual([]);
  });

  it("groups devices and reads each user's vocabulary once", async () => {
    const fake = createFakeDependencies({ devices: DEVICES, vocabularies: VOCABULARIES });

    const result = await runVocabularyReminderDispatch(fake.dependencies, ACTIVE_TIME);

    expect(fake.vocabularyReads).toEqual(["alice", "bob"]);
    expect(fake.sentMessages).toHaveLength(2);
    expect(fake.sentMessages[0]).toEqual({
      tokens: ["token-a1", "token-a2"],
      data: {
        title: "Từ vựng: apple /ˈæp.əl/",
        body: "noun • quả táo",
        vocabularyId: "a-word",
        word: "apple",
        url: "/dictionary"
      }
    });
    expect(result).toEqual({ usersConsidered: 2, usersSent: 2, devicesSent: 3, devicesRemoved: 0 });
  });

  it("skips users without vocabulary before claiming a window", async () => {
    const fake = createFakeDependencies({ devices: [DEVICES[0]], vocabularies: { alice: [] } });

    const result = await runVocabularyReminderDispatch(fake.dependencies, ACTIVE_TIME);

    expect(fake.events).toEqual(["list-devices", "list-vocabularies:alice"]);
    expect(result.usersSent).toBe(0);
  });

  it("does not send when the current window was already claimed", async () => {
    const fake = createFakeDependencies({
      devices: [DEVICES[0]],
      vocabularies: VOCABULARIES,
      alreadyClaimedUsers: ["alice"]
    });

    const result = await runVocabularyReminderDispatch(fake.dependencies, ACTIVE_TIME);

    expect(fake.sentMessages).toEqual([]);
    expect(result.usersSent).toBe(0);
  });

  it("claims the window before sending", async () => {
    const fake = createFakeDependencies({ devices: [DEVICES[0]], vocabularies: VOCABULARIES });

    await runVocabularyReminderDispatch(fake.dependencies, ACTIVE_TIME);

    expect(fake.events.indexOf("claim:alice")).toBeLessThan(fake.events.indexOf("send:token-a1"));
  });

  it("deletes invalid registrations but retains transient failures", async () => {
    const fake = createFakeDependencies({
      devices: DEVICES.slice(0, 2),
      vocabularies: VOCABULARIES,
      responses: [
        { success: false, errorCode: "messaging/registration-token-not-registered" },
        { success: false, errorCode: "messaging/internal-error" }
      ]
    });

    const result = await runVocabularyReminderDispatch(fake.dependencies, ACTIVE_TIME);

    expect(fake.deletedPaths).toEqual(["notificationUsers/alice/devices/a1"]);
    expect(fake.events.filter((event) => event === "log-error")).toHaveLength(1);
    expect(result).toEqual({ usersConsidered: 1, usersSent: 1, devicesSent: 0, devicesRemoved: 1 });
  });
});
