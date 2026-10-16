import { describe, expect, it } from "vitest";
import { getDispatchExitCode } from "../src/dispatchVocabularyRemindersCli";
import type { DispatchSummary } from "../src/sendVocabularyReminders";

function summary(overrides: Partial<DispatchSummary> = {}): DispatchSummary {
  return {
    windowKey: "2026-10-16-08",
    scheduledAt: "2026-10-16T01:00:00.000Z",
    executedAt: "2026-10-16T01:05:00.000Z",
    usersConsidered: 1,
    usersWithVocabulary: 1,
    usersAttempted: 1,
    successfulDeviceSends: 1,
    failedDeviceSends: 0,
    invalidTokensRemoved: 0,
    retryableFailures: 0,
    durationMs: 10,
    ...overrides
  };
}

describe("getDispatchExitCode", () => {
  it("succeeds when every attempted device is accepted or cleaned up as invalid", () => {
    expect(getDispatchExitCode(summary({ invalidTokensRemoved: 1 }))).toBe(0);
  });

  it("fails the workflow for unresolved retryable failures", () => {
    expect(getDispatchExitCode(summary({ retryableFailures: 1, failedDeviceSends: 1 }))).toBe(1);
  });

  it("fails the workflow for permanent device rejections", () => {
    expect(getDispatchExitCode(summary({ successfulDeviceSends: 0, failedDeviceSends: 1 }))).toBe(1);
  });
});
