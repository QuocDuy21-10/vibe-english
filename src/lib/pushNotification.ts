export type VocabularyNotificationDisplay = {
  title: string;
  options: NotificationOptions;
};

export function normalizeNotificationPath(value: string | undefined): "/dictionary" | "/dashboard" {
  return value === "/dashboard" || value === "/dictionary" ? value : "/dictionary";
}

export function createVocabularyNotificationDisplay(
  data: Record<string, string> | undefined
): VocabularyNotificationDisplay {
  const url = normalizeNotificationPath(data?.url);
  const tag = data?.kind === "notification-test"
    ? "vocabloom-notification-test"
    : "vocabloom-vocabulary-reminder";

  return {
    title: data?.title || "Từ vựng Vocabloom",
    options: {
      body: data?.body || "Mở Vocabloom để ôn tập từ vựng.",
      icon: "/icon-192.png",
      badge: "/icon-maskable-512.png",
      tag,
      data: {
        vocabularyId: data?.vocabularyId || "",
        word: data?.word || "",
        url,
        messageId: data?.messageId || ""
      }
    }
  };
}

export function createRecentMessageDeduper(
  maxEntries = 100,
  ttlMs = 5 * 60 * 1000,
  now: () => number = Date.now
): (messageId: string) => boolean {
  const seen = new Map<string, number>();
  return (messageId) => {
    if (!messageId) return true;
    const currentTime = now();
    const previousTime = seen.get(messageId);
    if (previousTime !== undefined && currentTime - previousTime <= ttlMs) return false;
    seen.set(messageId, currentTime);
    for (const [id, timestamp] of seen) {
      if (currentTime - timestamp > ttlMs || seen.size > maxEntries) seen.delete(id);
    }
    return true;
  };
}
