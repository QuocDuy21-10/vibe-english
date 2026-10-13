import { describe, expect, it } from "vitest";
import {
  formatVocabularyNotification,
  isActiveReminderHour,
  isInvalidRegistrationError,
  selectVocabularyForWindow
} from "../src/notificationDomain";

const TIME_ZONE = "Asia/Ho_Chi_Minh";

describe("notificationDomain", () => {
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
