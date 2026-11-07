// @vitest-environment jsdom

import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ speak: vi.fn() }));
vi.mock("@/routes/AudioProvider", () => ({
  useAudioActions: () => ({ speak: mocks.speak, playSound: vi.fn(), cancelSpeech: vi.fn() })
}));

import { getQuizCard } from "@/components/features/study/quizCards";
import type { Vocabulary } from "@/types/types";

const vocabulary = { id: "v1", word: "deploy", definition: "triển khai", phonetic: "/dɪˈplɔɪ/" } as Vocabulary;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("listening quiz card", () => {
  it("answers with the word and speaks it on mount and on replay", async () => {
    mocks.speak.mockResolvedValue({ status: "queued" });
    const card = getQuizCard({ mode: "listening", vocabulary });
    if (card.status !== "ready") throw new Error("expected ready card");
    expect(card.answer).toBe("deploy");

    render(<>{card.prompt}</>);
    await waitFor(() => expect(mocks.speak).toHaveBeenCalledWith("deploy"));
    fireEvent.click(screen.getByRole("button", { name: /Nghe lại/ }));
    expect(mocks.speak).toHaveBeenCalledTimes(2);
  });

  it("shows the phonetic fallback when speech is unsupported", async () => {
    mocks.speak.mockResolvedValue({ status: "unsupported" });
    const card = getQuizCard({ mode: "listening", vocabulary });
    if (card.status !== "ready") throw new Error("expected ready card");
    render(<>{card.prompt}</>);
    expect(await screen.findByText(/\/dɪˈplɔɪ\//)).toBeTruthy();
  });

  it("reveals meaning and phonetic after answering", () => {
    const card = getQuizCard({ mode: "listening", vocabulary });
    if (card.status !== "ready") throw new Error("expected ready card");
    render(<>{card.afterAnswer}</>);
    expect(screen.getByText("triển khai")).toBeTruthy();
  });
});
