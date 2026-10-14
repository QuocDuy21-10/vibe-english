import type { SoundEffect } from "@/lib/soundEffects";

export type StudyAudioEvent =
  | { type: "quiz-checked"; correct: boolean }
  | { type: "flashcard-flipped" }
  | { type: "session-completed" }
  | { type: "answer-edited" }
  | { type: "answer-revealed" }
  | { type: "pronunciation-requested" }
  | { type: "review-failed" }
  | { type: "review-persisted" };

export function getStudySound(event: StudyAudioEvent): SoundEffect | null {
  if (event.type === "quiz-checked") return event.correct ? "correct" : "incorrect";
  if (event.type === "flashcard-flipped") return "card-flip";
  if (event.type === "session-completed") return "complete";
  return null;
}
