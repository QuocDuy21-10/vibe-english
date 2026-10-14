import type { PronunciationResult, PronunciationStatus } from "@/lib/pronunciation";

type VoiceState = "loading" | "ready" | "unsupported";

type PronunciationNoticeInput = {
  voiceState: VoiceState;
  voiceCount: number;
  exactVoiceCount: number;
  pronunciationStatus: PronunciationStatus;
  result: PronunciationResult | null;
};

export type PronunciationNotice =
  | { type: "unsupported" }
  | { type: "loading" }
  | { type: "no-voices" }
  | { type: "no-exact" }
  | { type: "no-english" }
  | { type: "error" }
  | { type: "fallback"; locale: string }
  | { type: "device-dependent" };

export function getPronunciationNotice(input: PronunciationNoticeInput): PronunciationNotice {
  if (input.voiceState === "unsupported") return { type: "unsupported" };
  if (input.voiceState === "loading") return { type: "loading" };
  if (input.result?.status === "no-english") return { type: "no-english" };
  if (input.result?.status === "error" || input.pronunciationStatus === "error") {
    return { type: "error" };
  }
  if (input.result?.fallback && input.result.actualLocale) {
    return { type: "fallback", locale: input.result.actualLocale };
  }
  if (input.voiceCount === 0) return { type: "no-voices" };
  if (input.exactVoiceCount === 0) return { type: "no-exact" };
  return { type: "device-dependent" };
}
