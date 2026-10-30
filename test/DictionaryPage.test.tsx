// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  audioActions: vi.fn(() => ({
    speak: vi.fn(),
    playSound: vi.fn(),
    cancelSpeech: vi.fn()
  })),
  deleteVocabulary: vi.fn()
}));

vi.mock("@/routes/AudioProvider", () => ({ useAudioActions: mocks.audioActions }));
vi.mock("@/services/vocabularyRepository", () => ({ deleteVocabulary: mocks.deleteVocabulary }));

import { VocabCard } from "@/components/features/VocabCard";
import type { Topic, Vocabulary } from "@/types/types";

const topic: Topic = {
  id: "topic-1",
  name: "Travel",
  userId: "user-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z")
};

const vocabulary: Vocabulary = {
  id: "vocab-1",
  word: "travel",
  definition: "du lịch",
  partOfSpeech: "noun",
  phonetic: "/ˈtræv.əl/",
  topicId: topic.id,
  userId: "user-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  level: 0,
  nextReview: null
};

describe("dictionary card render boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("skips an unchanged vocabulary card when its parent rerenders", () => {
    const props = {
      vocabulary,
      topics: [topic],
      topicName: topic.name,
      synonymLabels: [],
      vocabularies: [vocabulary]
    };
    const view = render(<VocabCard {...props} />);

    expect(mocks.audioActions).toHaveBeenCalledTimes(1);
    view.rerender(<VocabCard {...props} />);

    expect(mocks.audioActions).toHaveBeenCalledTimes(1);
  });
});
