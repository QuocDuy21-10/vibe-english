import { describe, expect, it } from "vitest";
import { createVocabularyNotificationDisplay } from "@/lib/pushNotification";

describe("createVocabularyNotificationDisplay", () => {
  it("maps an FCM data message to the concise operating-system notification", () => {
    expect(createVocabularyNotificationDisplay({
      title: "Từ vựng: apple /ˈæp.əl/",
      body: "noun • quả táo",
      vocabularyId: "vocab-1",
      word: "apple",
      url: "/dictionary",
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
          url: "/dictionary"
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
          url: "/dictionary"
        }
      }
    });
  });
});
