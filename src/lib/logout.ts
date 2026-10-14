export type LogoutCleanupResult = "completed" | "failed" | "timed-out";

export async function runLogoutWithNotificationCleanup(
  cleanup: () => Promise<void>,
  signOut: () => Promise<void>,
  timeoutMs: number
): Promise<LogoutCleanupResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const cleanupResult = Promise.resolve()
    .then(cleanup)
    .then<LogoutCleanupResult, LogoutCleanupResult>(
      () => "completed",
      () => "failed"
    );
  const timeoutResult = new Promise<LogoutCleanupResult>((resolve) => {
    timeoutId = setTimeout(() => resolve("timed-out"), timeoutMs);
  });

  const result = await Promise.race([cleanupResult, timeoutResult]);
  if (timeoutId) clearTimeout(timeoutId);
  await signOut();
  return result;
}
