import { describe, expect, it } from "vitest";
import {
  createRecentMessageDeduper,
  createVocabularyNotificationDisplay
} from "@/lib/pushNotification";

describe("createVocabularyNotificationDisplay", () => {
  it("maps an FCM data message to the concise operating-system notification", () => {
    expect(createVocabularyNotificationDisplay({
      title: "Từ vựng: apple /ˈæp.əl/",
      body: "noun • quả táo",
      vocabularyId: "vocab-1",
      word: "apple",
      url: "/dictionary",
      kind: "vocabulary-reminder",
      messageId: "message-1",
      unexpected: "must-not-be-copied"
    })).toEqual({
      title: "Từ vựng: apple /ˈæp.əl/",
      options: {
        body: "noun • quả táo",
        icon: "/icon-192.png",
        badge: "/icon-maskable-512.png",
        tag: "vocabloom-vocabulary-reminder",
        data: {
          vocabularyId: "vocab-1",
          word: "apple",
          url: "/dictionary",
          messageId: "message-1"
        }
      }
    });
  });

  it("uses safe text and navigation defaults for malformed data", () => {
    expect(createVocabularyNotificationDisplay(undefined)).toEqual({
      title: "Từ vựng Vocabloom",
      options: {
        body: "Mở Vocabloom để ôn tập từ vựng.",
        icon: "/icon-192.png",
        badge: "/icon-maskable-512.png",
        tag: "vocabloom-vocabulary-reminder",
        data: {
          vocabularyId: "",
          word: "",
          url: "/dictionary",
          messageId: ""
        }
      }
    });
  });

  it("rejects protocol-relative and unknown notification routes", () => {
    expect(createVocabularyNotificationDisplay({ url: "//evil.example" }).options.data).toMatchObject({
      url: "/dictionary"
    });
    expect(createVocabularyNotificationDisplay({ url: "/admin" }).options.data).toMatchObject({
      url: "/dictionary"
    });
  });

  it("uses a separate replacement tag for test notifications", () => {
    const display = createVocabularyNotificationDisplay({
      title: "Test",
      body: "Test body",
      kind: "notification-test",
      messageId: "test-1",
      url: "/dashboard"
    });

    expect(display.options.tag).toBe("vocabloom-notification-test");
    expect(display.options.data).toMatchObject({ url: "/dashboard", messageId: "test-1" });
  });

  it("suppresses a duplicate message ID within five minutes", () => {
    let now = 0;
    const shouldDisplay = createRecentMessageDeduper(100, 5 * 60 * 1000, () => now);

    expect(shouldDisplay("message-1")).toBe(true);
    expect(shouldDisplay("message-1")).toBe(false);
    now = 5 * 60 * 1000 + 1;
    expect(shouldDisplay("message-1")).toBe(true);
  });
});
