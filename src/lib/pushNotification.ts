export type VocabularyNotificationDisplay = {
  title: string;
  options: NotificationOptions;
};

export function createVocabularyNotificationDisplay(
  data: Record<string, string> | undefined
): VocabularyNotificationDisplay {
  const url = data?.url?.startsWith("/") ? data.url : "/dictionary";

  return {
    title: data?.title || "Từ vựng Vocabloom",
    options: {
      body: data?.body || "Mở Vocabloom để ôn tập từ vựng.",
      icon: "/icon-192.png",
      badge: "/icon-maskable-512.png",
      tag: "vocabloom-vocabulary-reminder",
      data: {
        vocabularyId: data?.vocabularyId || "",
        word: data?.word || "",
        url
      }
    }
  };
}
