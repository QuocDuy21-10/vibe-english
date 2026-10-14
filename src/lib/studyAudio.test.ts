import { describe, expect, it } from "vitest";

import { getStudySound, type StudyAudioEvent } from "@/lib/studyAudio";

describe("study audio policy", () => {
  it.each([
    [{ type: "quiz-checked", correct: true }, "correct"],
    [{ type: "quiz-checked", correct: false }, "incorrect"],
    [{ type: "flashcard-flipped" }, "card-flip"],
    [{ type: "session-completed" }, "complete"]
  ] as const)("maps %o to %s", (event, expected) => {
    expect(getStudySound(event)).toBe(expected);
  });

  it.each<StudyAudioEvent>([
    { type: "answer-edited" },
    { type: "answer-revealed" },
    { type: "pronunciation-requested" },
    { type: "review-failed" },
    { type: "review-persisted" }
  ])("keeps %o silent", (event) => {
    expect(getStudySound(event)).toBeNull();
  });
});
