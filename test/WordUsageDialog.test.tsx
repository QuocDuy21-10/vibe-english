// @vitest-environment jsdom

import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWordUsage: vi.fn(),
  generateWordUsages: vi.fn(),
  toastError: vi.fn()
}));

vi.mock("@/services/wordUsageRepository", () => ({
  getWordUsage: mocks.getWordUsage,
  generateWordUsages: mocks.generateWordUsages,
  isWordUsageStale: (usage: { word: string }, vocabulary: { word: string }) => usage.word !== vocabulary.word
}));
vi.mock("@/routes/AppDataProvider", () => ({ useAuth: () => ({ user: { uid: "alice" } }) }));
vi.mock("@/routes/AudioProvider", () => ({
  useAudioActions: () => ({ speak: vi.fn(), playSound: vi.fn(), cancelSpeech: vi.fn() })
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@/components/ui/dialog", () => ({
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>
}));

import { WordUsageDialog } from "@/components/features/WordUsageDialog";
import type { Vocabulary } from "@/types/types";

const vocabulary = { id: "v1", word: "deploy", definition: "triển khai", partOfSpeech: "verb" } as Vocabulary;
const usage = {
  userId: "alice",
  vocabularyId: "v1",
  word: "deploy",
  generatedAt: new Date(),
  examples: [{ sentence: "We deployed it.", translation: "Đã triển khai.", answer: "deployed" }],
  collocations: [{ phrase: "deploy code", meaning: "triển khai mã" }]
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WordUsageDialog", () => {
  it("shows cached usage without calling AI", async () => {
    mocks.getWordUsage.mockResolvedValue(usage);
    render(<WordUsageDialog vocabulary={vocabulary} />);
    expect(await screen.findByText("We deployed it.")).toBeTruthy();
    expect(screen.getByText("deploy code")).toBeTruthy();
    expect(mocks.generateWordUsages).not.toHaveBeenCalled();
  });

  it("generates when the cache is missing", async () => {
    mocks.getWordUsage.mockResolvedValue(null);
    mocks.generateWordUsages.mockResolvedValue([usage]);
    render(<WordUsageDialog vocabulary={vocabulary} />);
    expect(await screen.findByText("We deployed it.")).toBeTruthy();
    expect(mocks.generateWordUsages).toHaveBeenCalledWith([vocabulary], "alice");
  });

  it("regenerates when the cache is stale or on Tạo lại", async () => {
    mocks.getWordUsage.mockResolvedValue({ ...usage, word: "old" });
    mocks.generateWordUsages.mockResolvedValue([usage]);
    render(<WordUsageDialog vocabulary={vocabulary} />);
    await screen.findByText("We deployed it.");
    expect(mocks.generateWordUsages).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Tạo lại/ }));
    await waitFor(() => expect(mocks.generateWordUsages).toHaveBeenCalledTimes(2));
  });

  it("shows an error state with retry and toasts the message", async () => {
    mocks.getWordUsage.mockResolvedValue(null);
    mocks.generateWordUsages.mockRejectedValue(new Error("Bạn đã tra quá 300 từ trong 1 giờ."));
    render(<WordUsageDialog vocabulary={vocabulary} />);
    expect(await screen.findByRole("button", { name: /Thử lại/ })).toBeTruthy();
    expect(mocks.toastError).toHaveBeenCalledWith("Bạn đã tra quá 300 từ trong 1 giờ.");
  });
});
