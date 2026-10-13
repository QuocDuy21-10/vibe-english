import { afterEach, describe, expect, it, vi } from "vitest";
import { runLogoutWithNotificationCleanup } from "@/lib/logout";

describe("runLogoutWithNotificationCleanup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("signs out after a bounded wait when notification cleanup never settles", async () => {
    vi.useFakeTimers();
    const signOut = vi.fn().mockResolvedValue(undefined);
    const cleanup = vi.fn(() => new Promise<void>(() => undefined));

    const resultPromise = runLogoutWithNotificationCleanup(cleanup, signOut, 1_500);
    await vi.advanceTimersByTimeAsync(1_500);

    await expect(resultPromise).resolves.toBe("timed-out");
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("signs out and reports a rejected cleanup", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);

    await expect(runLogoutWithNotificationCleanup(
      () => Promise.reject(new Error("cleanup failed")),
      signOut,
      1_500
    )).resolves.toBe("failed");
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
