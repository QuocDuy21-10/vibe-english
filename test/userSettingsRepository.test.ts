import { beforeEach, describe, expect, it, vi } from "vitest";
import { onSnapshot, setDoc } from "firebase/firestore";
import { setDailyGoal, subscribeUserSettings } from "@/services/userSettingsRepository";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, name, id) => `doc:${name}/${id}`),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP")
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/firestoreErrors", () => ({ handleFirestoreError: vi.fn() }));

import { handleFirestoreError } from "@/lib/firestoreErrors";

describe("userSettingsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes only dailyGoal and a server timestamp", async () => {
    vi.mocked(setDoc).mockResolvedValueOnce(undefined);

    await setDailyGoal("user-1", 20);

    expect(setDoc).toHaveBeenCalledWith("doc:userSettings/user-1", {
      dailyGoal: 20,
      updatedAt: "SERVER_TIMESTAMP"
    });
  });

  it("reports and rethrows write failures", async () => {
    const error = new Error("denied");
    vi.mocked(setDoc).mockRejectedValueOnce(error);

    await expect(setDailyGoal("user-1", 20)).rejects.toThrow("denied");
    expect(handleFirestoreError).toHaveBeenCalledWith(error, "write", "userSettings/user-1");
  });

  it("emits null when the settings document does not exist", () => {
    vi.mocked(onSnapshot).mockImplementationOnce(((_ref: unknown, onNext: (snapshot: unknown) => void) => {
      onNext({ exists: () => false, data: () => undefined });
      return vi.fn();
    }) as any);
    const onNext = vi.fn();

    subscribeUserSettings("user-1", onNext);

    expect(onNext).toHaveBeenCalledWith(null);
  });

  it("emits stored settings", () => {
    vi.mocked(onSnapshot).mockImplementationOnce(((_ref: unknown, onNext: (snapshot: unknown) => void) => {
      onNext({ exists: () => true, data: () => ({ dailyGoal: 30, updatedAt: "X" }) });
      return vi.fn();
    }) as any);
    const onNext = vi.fn();

    subscribeUserSettings("user-1", onNext);

    expect(onNext).toHaveBeenCalledWith({ dailyGoal: 30, updatedAt: "X" });
  });

  it("reports subscription errors and forwards them", () => {
    const error = new Error("offline");
    vi.mocked(onSnapshot).mockImplementationOnce(((_ref: unknown, _next: unknown, onError: (e: unknown) => void) => {
      onError(error);
      return vi.fn();
    }) as any);
    const onError = vi.fn();

    subscribeUserSettings("user-1", vi.fn(), onError);

    expect(handleFirestoreError).toHaveBeenCalledWith(error, "get", "userSettings/user-1");
    expect(onError).toHaveBeenCalledWith(error);
  });
});
