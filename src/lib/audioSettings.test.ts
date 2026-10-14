import { describe, expect, it, vi } from "vitest";

import {
  AUDIO_SETTINGS_STORAGE_KEY,
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  normalizeAudioSettings,
  saveAudioSettings,
  updateAudioSettings
} from "@/lib/audioSettings";

function createStorage(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue;
    })
  };
}

describe("audio settings", () => {
  it("uses gentle US English defaults", () => {
    expect(DEFAULT_AUDIO_SETTINGS).toEqual({
      version: 1,
      soundEffectsEnabled: true,
      soundEffectsVolume: 0.35,
      accent: "en-US",
      voiceURI: null
    });
  });

  it("normalizes supported values and clamps volume", () => {
    expect(normalizeAudioSettings({
      version: 1,
      soundEffectsEnabled: false,
      soundEffectsVolume: 2,
      accent: "en-GB",
      voiceURI: "voice-gb"
    })).toEqual({
      version: 1,
      soundEffectsEnabled: false,
      soundEffectsVolume: 1,
      accent: "en-GB",
      voiceURI: "voice-gb"
    });
  });

  it("falls back for invalid or legacy stored data", () => {
    expect(loadAudioSettings(createStorage("not-json"))).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings(createStorage(JSON.stringify({ version: 0 })))).toEqual(
      DEFAULT_AUDIO_SETTINGS
    );
    expect(normalizeAudioSettings({
      version: 1,
      soundEffectsEnabled: "yes",
      soundEffectsVolume: "loud",
      accent: "fr-FR",
      voiceURI: 12
    })).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("persists normalized settings under the versioned key", () => {
    const storage = createStorage();
    const settings = { ...DEFAULT_AUDIO_SETTINGS, accent: "en-GB" as const };

    saveAudioSettings(settings, storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      AUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings)
    );
    expect(loadAudioSettings(storage)).toEqual(settings);
  });

  it("resets a selected voice when the accent changes", () => {
    const current = { ...DEFAULT_AUDIO_SETTINGS, voiceURI: "voice-us" };

    expect(updateAudioSettings(current, { accent: "en-GB" })).toEqual({
      ...DEFAULT_AUDIO_SETTINGS,
      accent: "en-GB",
      voiceURI: null
    });
    expect(updateAudioSettings(current, { soundEffectsEnabled: false }).voiceURI).toBe(
      "voice-us"
    );
  });
});
