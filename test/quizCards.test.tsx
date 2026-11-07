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

describe("context quiz card", () => {
  const usage = {
    userId: "u",
    vocabularyId: "v1",
    word: "deploy",
    generatedAt: new Date(),
    collocations: [],
    examples: [{ sentence: "We deployed it yesterday.", translation: "Hôm qua chúng tôi đã triển khai.", answer: "deployed" }]
  };

  it("is loading until usage is ready", () => {
    expect(getQuizCard({ mode: "context", vocabulary, usageState: { status: "loading" } }).status).toBe("loading");
    expect(getQuizCard({ mode: "context", vocabulary }).status).toBe("loading");
  });

  it("is an error card when generation failed or no example is usable", () => {
    const onRetry = vi.fn();
    const failed = getQuizCard({ mode: "context", vocabulary, usageState: { status: "error" }, onRetry });
    expect(failed.status).toBe("error");
    const empty = getQuizCard({
      mode: "context",
      vocabulary,
      usageState: { status: "ready", usage: { ...usage, examples: [] } },
      onRetry
    });
    expect(empty.status).toBe("error");
  });

  it("blanks the inflected form and reveals the full sentence after answering", () => {
    const card = getQuizCard({
      mode: "context",
      vocabulary,
      usageState: { status: "ready", usage },
      seed: "s"
    });
    if (card.status !== "ready") throw new Error("expected ready card");
    expect(card.answer).toBe("deployed");

    render(<>{card.prompt}</>);
    expect(screen.getByText(/We\s*_{3,}\s*it yesterday\./)).toBeTruthy();
    expect(screen.getByText("triển khai")).toBeTruthy();
    cleanup();

    render(<>{card.afterAnswer}</>);
    expect(screen.getByText("We deployed it yesterday.")).toBeTruthy();
    expect(screen.getByText("Hôm qua chúng tôi đã triển khai.")).toBeTruthy();
  });
});
