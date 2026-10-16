// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getCurrentDeviceSubscription: vi.fn(),
  enableVocabularyNotifications: vi.fn(),
  disableVocabularyNotifications: vi.fn(),
  sendTestVocabularyNotification: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn()
}));

vi.mock("@/services/notificationService", () => ({
  getCurrentDeviceSubscription: mocks.getCurrentDeviceSubscription,
  enableVocabularyNotifications: mocks.enableVocabularyNotifications,
  disableVocabularyNotifications: mocks.disableVocabularyNotifications,
  sendTestVocabularyNotification: mocks.sendTestVocabularyNotification
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo
  }
}));

import { VocabularyNotificationCard } from "@/components/features/VocabularyNotificationCard";

describe("VocabularyNotificationCard test push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false })
    });
    mocks.getCurrentDeviceSubscription.mockResolvedValue({
      capability: "granted",
      subscribed: true
    });
  });

  afterEach(() => cleanup());

  it("shows a test action only for the subscribed current device", async () => {
    render(<VocabularyNotificationCard userId="alice" vocabularyCount={3} />);

    expect(await screen.findByRole("button", { name: "Gửi thông báo thử" })).toBeTruthy();
  });

  it("prevents duplicate requests while a test push is in flight", async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    mocks.sendTestVocabularyNotification.mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<VocabularyNotificationCard userId="alice" vocabularyCount={3} />);
    const button = await screen.findByRole("button", { name: "Gửi thông báo thử" });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(mocks.sendTestVocabularyNotification).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Đang gửi thử" })).toHaveProperty(
      "disabled",
      true
    );
    resolveRequest?.({
      ok: true,
      status: "accepted",
      messageId: "message-1",
      acceptedAt: "2026-10-15T01:00:00.000Z"
    });
    await waitFor(() => {
      expect(screen.getByText(
        "FCM đã chấp nhận thông báo thử. Hãy kiểm tra thông báo trên thiết bị."
      )).toBeTruthy();
    });
  });

  it("shows a precise failure without changing the enabled state", async () => {
    mocks.sendTestVocabularyNotification.mockRejectedValue(new Error("FCM rejected"));
    render(<VocabularyNotificationCard userId="alice" vocabularyCount={3} />);
    fireEvent.click(await screen.findByRole("button", { name: "Gửi thông báo thử" }));

    expect(await screen.findByText("FCM rejected")).toBeTruthy();
    expect(screen.getByText("Đang bật trên thiết bị này")).toBeTruthy();
  });
});
