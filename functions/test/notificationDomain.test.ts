import { describe, expect, it } from "vitest";
import {
  formatVocabularyNotification,
  isActiveReminderHour,
  isInvalidRegistrationError,
  resolveDispatchWindow,
  selectVocabularyForWindow
} from "../src/notificationDomain";

const TIME_ZONE = "Asia/Ho_Chi_Minh";

describe("notificationDomain", () => {
  describe("resolveDispatchWindow", () => {
    it.each([
      ["0 1 * * *", "2026-10-13T01:06:00.000Z", "2026-10-13T01:00:00.000Z", "2026-10-13-08"],
      ["0 3 * * *", "2026-10-13T03:06:00.000Z", "2026-10-13T03:00:00.000Z", "2026-10-13-10"],
      ["0 5 * * *", "2026-10-13T05:06:00.000Z", "2026-10-13T05:00:00.000Z", "2026-10-13-12"],
      ["0 7 * * *", "2026-10-13T07:06:00.000Z", "2026-10-13T07:00:00.000Z", "2026-10-13-14"],
      ["0 9 * * *", "2026-10-13T09:06:00.000Z", "2026-10-13T09:00:00.000Z", "2026-10-13-16"],
      ["0 11 * * *", "2026-10-13T11:06:00.000Z", "2026-10-13T11:00:00.000Z", "2026-10-13-18"],
      ["0 13 * * *", "2026-10-13T13:06:00.000Z", "2026-10-13T13:00:00.000Z", "2026-10-13-20"]
    ])("maps %s to its intended Vietnam window", (eventSchedule, executedIso, scheduledIso, windowKey) => {
      const result = resolveDispatchWindow({
        source: "schedule",
        mode: "live",
        eventSchedule,
        executedAt: new Date(executedIso)
      });

      expect(result).toEqual({
        action: "dispatch",
        mode: "live",
        source: "schedule",
        scheduledAt: new Date(scheduledIso),
        executedAt: new Date(executedIso),
        windowKey,
        delayMs: 6 * 60 * 1000
      });
    });

    it("accepts a scheduled run delayed from 08:00 to 09:05 Vietnam time", () => {
      const result = resolveDispatchWindow({
        source: "schedule",
        mode: "live",
        eventSchedule: "0 1 * * *",
        executedAt: new Date("2026-10-13T02:05:00.000Z")
      });

      expect(result.action).toBe("dispatch");
      expect(result.windowKey).toBe("2026-10-13-08");
      expect(result.delayMs).toBe(65 * 60 * 1000);
    });

    it("skips a scheduled run delayed beyond 90 minutes", () => {
      expect(resolveDispatchWindow({
        source: "schedule",
        mode: "live",
        eventSchedule: "0 1 * * *",
        executedAt: new Date("2026-10-13T02:31:00.000Z")
      })).toEqual({
        action: "skip",
        mode: "live",
        source: "schedule",
        scheduledAt: new Date("2026-10-13T01:00:00.000Z"),
        executedAt: new Date("2026-10-13T02:31:00.000Z"),
        windowKey: "2026-10-13-08",
        delayMs: 91 * 60 * 1000,
        reason: "skipped-too-late"
      });
    });

    it("allows manual dry-run for an older valid slot without sending it live", () => {
      const result = resolveDispatchWindow({
        source: "manual",
        mode: "dry-run",
        manualScheduledAt: "2026-10-12T08:00:00+07:00",
        executedAt: new Date("2026-10-13T01:00:00.000Z")
      });

      expect(result.action).toBe("dispatch");
      expect(result.mode).toBe("dry-run");
      expect(result.windowKey).toBe("2026-10-12-08");
    });

    it("uses the latest Vietnam slot when manual dry-run omits scheduled_at", () => {
      const result = resolveDispatchWindow({
        source: "manual",
        mode: "dry-run",
        executedAt: new Date("2026-10-13T04:25:00.000Z")
      });

      expect(result.action).toBe("dispatch");
      expect(result.scheduledAt).toEqual(new Date("2026-10-13T03:00:00.000Z"));
      expect(result.windowKey).toBe("2026-10-13-10");
    });

    it("rejects manual live without explicit confirmation", () => {
      const result = resolveDispatchWindow({
        source: "manual",
        mode: "live",
        manualScheduledAt: "2026-10-13T08:00:00+07:00",
        confirmLive: false,
        executedAt: new Date("2026-10-13T01:05:00.000Z")
      });

      expect(result.action).toBe("reject");
      expect(result.reason).toBe("manual-live-not-confirmed");
    });

    it("rejects manual live for a time outside an allowed slot", () => {
      const result = resolveDispatchWindow({
        source: "manual",
        mode: "live",
        manualScheduledAt: "2026-10-13T09:00:00+07:00",
        confirmLive: true,
        executedAt: new Date("2026-10-13T02:05:00.000Z")
      });

      expect(result.action).toBe("reject");
      expect(result.reason).toBe("invalid-reminder-slot");
    });
  });

  describe("isActiveReminderHour", () => {
    it.each([
      ["2026-10-13T00:00:00.000Z", false],
      ["2026-10-13T01:00:00.000Z", true],
      ["2026-10-13T02:00:00.000Z", false],
      ["2026-10-13T13:00:00.000Z", true],
      ["2026-10-13T14:00:00.000Z", false]
    ])("returns the schedule decision for %s", (iso, expected) => {
      expect(isActiveReminderHour(new Date(iso), TIME_ZONE)).toBe(expected);
    });
  });

  describe("formatVocabularyNotification", () => {
    it("formats all concise vocabulary fields", () => {
      expect(formatVocabularyNotification({
        id: "vocab-1",
        word: "serendipity",
        phonetic: "/ˌser.ənˈdɪp.ə.ti/",
        partOfSpeech: "noun",
        definition: "sự tình cờ may mắn"
      })).toEqual({
        title: "Từ vựng: serendipity /ˌser.ənˈdɪp.ə.ti/",
        body: "noun • sự tình cờ may mắn"
      });
    });

    it("omits empty optional fields without dangling separators", () => {
      expect(formatVocabularyNotification({
        id: "vocab-2",
        word: "hello",
        phonetic: "  ",
        partOfSpeech: "",
        definition: " xin chào "
      })).toEqual({
        title: "Từ vựng: hello",
        body: "xin chào"
      });
    });

    it("caps title and body with one ellipsis", () => {
      const result = formatVocabularyNotification({
        id: "vocab-3",
        word: "w".repeat(100),
        phonetic: "/very-long-phonetic/",
        partOfSpeech: "adjective",
        definition: "d".repeat(300)
      });

      expect(result.title).toHaveLength(100);
      expect(result.title.endsWith("…")).toBe(true);
      expect(result.body).toHaveLength(220);
      expect(result.body.endsWith("…")).toBe(true);
    });
  });

  describe("selectVocabularyForWindow", () => {
    const vocabularies = [
      { id: "vocab-a", word: "apple", phonetic: "", partOfSpeech: "noun", definition: "quả táo" },
      { id: "vocab-b", word: "book", phonetic: "", partOfSpeech: "noun", definition: "quyển sách" },
      { id: "vocab-c", word: "calm", phonetic: "", partOfSpeech: "adjective", definition: "bình tĩnh" }
    ];

    it("returns the same candidate for the same user and window", () => {
      const first = selectVocabularyForWindow(vocabularies, "alice", "2026-10-13-08", null);
      const second = selectVocabularyForWindow(vocabularies, "alice", "2026-10-13-08", null);

      expect(first).toEqual(second);
      expect(vocabularies).toContainEqual(first);
    });

    it("allows the only vocabulary to repeat", () => {
      expect(selectVocabularyForWindow(
        [vocabularies[0]],
        "alice",
        "2026-10-13-10",
        "vocab-a"
      )).toEqual(vocabularies[0]);
    });

    it("avoids immediately repeating when another vocabulary exists", () => {
      const initial = selectVocabularyForWindow(vocabularies, "alice", "2026-10-13-12", null);
      const next = selectVocabularyForWindow(vocabularies, "alice", "2026-10-13-12", initial?.id ?? null);

      expect(next).toBeDefined();
      expect(next?.id).not.toBe(initial?.id);
    });

    it("returns null for an empty collection", () => {
      expect(selectVocabularyForWindow([], "alice", "2026-10-13-14", null)).toBeNull();
    });
  });

  describe("isInvalidRegistrationError", () => {
    it.each([
      "messaging/registration-token-not-registered",
      "messaging/invalid-registration-token"
    ])("classifies %s as invalid", (code) => {
      expect(isInvalidRegistrationError(code)).toBe(true);
    });

    it.each([
      "messaging/internal-error",
      "messaging/server-unavailable",
      "messaging/quota-exceeded",
      undefined
    ])("keeps registrations for transient code %s", (code) => {
      expect(isInvalidRegistrationError(code)).toBe(false);
    });
  });
});
