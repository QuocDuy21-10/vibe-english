// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  topicDialog: vi.fn(() => null),
  deleteTopic: vi.fn(),
  authUser: null as { uid: string } | null,
  topics: [topicPlaceholder()],
  vocabularies: []
}));

function topicPlaceholder() {
  return {
    id: "topic-1",
    name: "Travel",
    userId: "user-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z")
  };
}

vi.mock("@/components/features/TopicDialog", () => ({ TopicDialog: mocks.topicDialog }));
vi.mock("@/services/topicRepository", () => ({ deleteTopic: mocks.deleteTopic }));
vi.mock("@/routes/AppDataProvider", () => ({
  useAuth: () => ({ user: mocks.authUser }),
  useVocabularyData: () => ({ topics: mocks.topics, vocabularies: mocks.vocabularies })
}));

import { TopicCard } from "@/components/features/TopicCard";
import { TopicsPage } from "@/pages/TopicsPage";
import type { Topic } from "@/types/types";

const topic: Topic = {
  id: "topic-1",
  name: "Travel",
  userId: "user-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z")
};

describe("topic card render boundary", () => {
  beforeEach(() => {
    mocks.authUser = { uid: "user-1" };
    vi.clearAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it("skips an unchanged topic card when its parent rerenders", () => {
    const props = {
      topic,
      vocabularyCount: 3,
      userId: "user-1",
      onDelete: vi.fn()
    };
    const view = render(<TopicCard {...props} />);

    expect(mocks.topicDialog).toHaveBeenCalledTimes(1);
    view.rerender(<TopicCard {...props} />);

    expect(mocks.topicDialog).toHaveBeenCalledTimes(1);
  });

  it("keeps hook order stable when auth expires while the page is mounted", () => {
    const view = render(<TopicsPage />);
    mocks.authUser = null;

    expect(() => view.rerender(<TopicsPage />)).not.toThrow();
  });
});
