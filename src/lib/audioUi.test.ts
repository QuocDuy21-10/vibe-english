import { describe, expect, it } from "vitest";

import { getPronunciationNotice } from "@/lib/audioUi";

describe("pronunciation notice priority", () => {
  it("reports no-English after preview instead of promising a fallback", () => {
    expect(getPronunciationNotice({
      voiceState: "ready",
      voiceCount: 1,
      exactVoiceCount: 0,
      pronunciationStatus: "idle",
      result: {
        status: "no-english",
        requestedAccent: "en-US",
        actualLocale: null,
        fallback: true
      }
    })).toEqual({ type: "no-english" });
  });

  it("reports the actual locale before the generic no-exact warning", () => {
    expect(getPronunciationNotice({
      voiceState: "ready",
      voiceCount: 1,
      exactVoiceCount: 0,
      pronunciationStatus: "idle",
      result: {
        status: "queued",
        requestedAccent: "en-US",
        actualLocale: "en-GB",
        fallback: true
      }
    })).toEqual({ type: "fallback", locale: "en-GB" });
  });
});
