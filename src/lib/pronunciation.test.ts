import { describe, expect, it, vi } from "vitest";

import {
  BrowserPronunciationEngine,
  type PronunciationStatus
} from "@/lib/pronunciation";

function voice(
  voiceURI: string,
  lang: string,
  options: { isDefault?: boolean; local?: boolean } = {}
): SpeechSynthesisVoice {
  return {
    default: options.isDefault ?? false,
    lang,
    localService: options.local ?? true,
    name: voiceURI,
    voiceURI
  };
}

function createSpeechSynthesis(initialVoices: SpeechSynthesisVoice[] = []) {
  let voices = initialVoices;
  const listeners = new Set<EventListener>();
  const synthesis = {
    getVoices: vi.fn(() => voices),
    speak: vi.fn(),
    cancel: vi.fn(),
    addEventListener: vi.fn((_type: string, listener: EventListener) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: EventListener) => listeners.delete(listener)),
    setVoices(nextVoices: SpeechSynthesisVoice[]) {
      voices = nextVoices;
      listeners.forEach((listener) => listener(new Event("voiceschanged")));
    }
  };
  return synthesis;
}

function createHarness(initialVoices: SpeechSynthesisVoice[] = []) {
  const synthesis = createSpeechSynthesis(initialVoices);
  const utterances: SpeechSynthesisUtterance[] = [];
  const createUtterance = vi.fn((text: string) => {
    const utterance = {
      text,
      voice: null,
      lang: "",
      rate: 1,
      pitch: 1,
      onstart: null,
      onend: null,
      onerror: null
    } as unknown as SpeechSynthesisUtterance;
    utterances.push(utterance);
    return utterance;
  });
  const engine = new BrowserPronunciationEngine(
    synthesis as unknown as SpeechSynthesis,
    createUtterance
  );
  return { engine, synthesis, utterances };
}

describe("BrowserPronunciationEngine", () => {
  it("selects a requested en-US voice", async () => {
    const selected = voice("us-selected", "en-US");
    const harness = createHarness([voice("gb", "en-GB"), selected]);

    await expect(harness.engine.speak("hello", {
      accent: "en-US",
      voiceURI: selected.voiceURI
    })).resolves.toMatchObject({ status: "queued", actualLocale: "en-US", fallback: false });
    expect(harness.utterances[0].voice).toBe(selected);
  });

  it("selects the default exact en-GB voice", async () => {
    const preferred = voice("gb-default", "en-GB", { isDefault: true });
    const harness = createHarness([voice("gb-other", "en-GB"), preferred]);

    await harness.engine.speak("schedule", { accent: "en-GB" });

    expect(harness.utterances[0].voice).toBe(preferred);
    expect(harness.utterances[0].lang).toBe("en-GB");
  });

  it("waits for voiceschanged when the initial voice list is empty", async () => {
    const harness = createHarness();
    const speaking = harness.engine.speak("welcome", { accent: "en-US" });

    expect(harness.synthesis.speak).not.toHaveBeenCalled();
    harness.synthesis.setVoices([voice("us", "en-US")]);

    await expect(speaking).resolves.toMatchObject({ status: "queued", actualLocale: "en-US" });
  });

  it("publishes updated voice lists and cleans up its listener", () => {
    const harness = createHarness([voice("us", "en-US")]);
    const listener = vi.fn();

    const unsubscribe = harness.engine.subscribeVoices(listener);
    harness.synthesis.setVoices([voice("gb", "en-GB")]);
    unsubscribe();

    expect(listener).toHaveBeenNthCalledWith(
      2,
      [expect.objectContaining({ voiceURI: "gb", lang: "en-GB" })]
    );
    expect(harness.synthesis.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it("falls back when a previously selected voice disappears", async () => {
    const replacement = voice("us-default", "en-US", { isDefault: true });
    const harness = createHarness([replacement]);

    await harness.engine.speak("hello", { accent: "en-US", voiceURI: "missing" });

    expect(harness.utterances[0].voice).toBe(replacement);
  });

  it("reports a different English locale as an accent fallback", async () => {
    const harness = createHarness([voice("gb", "en-GB", { isDefault: true })]);

    await expect(harness.engine.speak("hello", { accent: "en-US" })).resolves.toEqual({
      status: "queued",
      requestedAccent: "en-US",
      actualLocale: "en-GB",
      fallback: true
    });
  });

  it("does not crash when speech synthesis is unsupported", async () => {
    const engine = new BrowserPronunciationEngine(null, null);

    await expect(engine.speak("hello", { accent: "en-US" })).resolves.toMatchObject({
      status: "unsupported"
    });
  });

  it("cancels queued speech before every new utterance", async () => {
    const harness = createHarness([voice("us", "en-US")]);

    await harness.engine.speak("first", { accent: "en-US" });
    await harness.engine.speak("second", { accent: "en-US" });

    expect(harness.synthesis.cancel).toHaveBeenCalledTimes(2);
    expect(harness.synthesis.speak).toHaveBeenLastCalledWith(harness.utterances[1]);
  });

  it("ignores empty text without touching the speech queue", async () => {
    const harness = createHarness([voice("us", "en-US")]);

    await expect(harness.engine.speak("   ", { accent: "en-US" })).resolves.toMatchObject({
      status: "empty"
    });
    expect(harness.synthesis.cancel).not.toHaveBeenCalled();
  });

  it("reports synchronous and asynchronous TTS failures without throwing", async () => {
    const harness = createHarness([voice("us", "en-US")]);
    const statuses: PronunciationStatus[] = [];
    harness.engine.subscribeStatus((status) => statuses.push(status));
    harness.synthesis.speak.mockImplementationOnce(() => {
      throw new Error("speech failed");
    });

    await expect(harness.engine.speak("hello", { accent: "en-US" })).resolves.toMatchObject({
      status: "error"
    });

    await harness.engine.speak("again", { accent: "en-US" });
    harness.utterances[1].onstart?.(new Event("start") as SpeechSynthesisEvent);
    harness.utterances[1].onerror?.(new Event("error") as SpeechSynthesisErrorEvent);
    expect(statuses).toContain("speaking");
    expect(statuses.at(-1)).toBe("error");
  });

  it("contains a browser failure while clearing the previous speech queue", async () => {
    const harness = createHarness([voice("us", "en-US")]);
    harness.synthesis.cancel.mockImplementationOnce(() => {
      throw new Error("cancel failed");
    });

    await expect(harness.engine.speak("hello", { accent: "en-US" })).resolves.toMatchObject({
      status: "error"
    });
    expect(harness.synthesis.speak).not.toHaveBeenCalled();
  });
});
