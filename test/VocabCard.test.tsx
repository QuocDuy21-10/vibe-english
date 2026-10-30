// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ editModuleLoads: 0 }));

vi.mock("@/components/features/EditVocabDialog", () => {
  mocks.editModuleLoads += 1;
  return { EditVocabDialog: () => null };
});
vi.mock("@/routes/AudioProvider", () => ({
  useAudioActions: () => ({ speak: vi.fn(), playSound: vi.fn(), cancelSpeech: vi.fn() })
}));
vi.mock("@/services/vocabularyRepository", () => ({ deleteVocabulary: vi.fn() }));

import { VocabCard } from "@/components/features/VocabCard";

afterEach(() => vi.clearAllMocks());

describe("vocabulary edit dialog module boundary", () => {
  it("does not load the edit dialog module while importing the card", () => {
    expect(VocabCard).toBeTruthy();
    expect(mocks.editModuleLoads).toBe(0);
  });
});
