export type EnglishAccent = "en-US" | "en-GB";

export type AudioSettings = {
  version: 1;
  soundEffectsEnabled: boolean;
  soundEffectsVolume: number;
  accent: EnglishAccent;
  voiceURI: string | null;
};

type AudioSettingsStorage = Pick<Storage, "getItem" | "setItem">;

export const AUDIO_SETTINGS_STORAGE_KEY = "vocabloom.audio-settings.v1";

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  version: 1,
  soundEffectsEnabled: true,
  soundEffectsVolume: 0.35,
  accent: "en-US",
  voiceURI: null
};

function defaultSettings(): AudioSettings {
  return { ...DEFAULT_AUDIO_SETTINGS };
}

export function normalizeAudioSettings(value: unknown): AudioSettings {
  if (!value || typeof value !== "object") return defaultSettings();

  const candidate = value as Partial<AudioSettings>;
  const isAccent = candidate.accent === "en-US" || candidate.accent === "en-GB";
  const isVoiceURI = candidate.voiceURI === null || typeof candidate.voiceURI === "string";
  if (
    candidate.version !== 1 ||
    typeof candidate.soundEffectsEnabled !== "boolean" ||
    typeof candidate.soundEffectsVolume !== "number" ||
    !Number.isFinite(candidate.soundEffectsVolume) ||
    !isAccent ||
    !isVoiceURI
  ) {
    return defaultSettings();
  }

  return {
    version: 1,
    soundEffectsEnabled: candidate.soundEffectsEnabled,
    soundEffectsVolume: Math.min(1, Math.max(0, candidate.soundEffectsVolume)),
    accent: candidate.accent,
    voiceURI: candidate.voiceURI?.trim() || null
  };
}

function getBrowserStorage(): AudioSettingsStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadAudioSettings(
  storage?: AudioSettingsStorage
): AudioSettings {
  const resolvedStorage = storage ?? getBrowserStorage();
  if (!resolvedStorage) return defaultSettings();
  try {
    const storedValue = resolvedStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    return storedValue ? normalizeAudioSettings(JSON.parse(storedValue)) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function saveAudioSettings(
  settings: AudioSettings,
  storage?: AudioSettingsStorage
): void {
  const resolvedStorage = storage ?? getBrowserStorage();
  if (!resolvedStorage) return;
  try {
    resolvedStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAudioSettings(settings)));
  } catch {
    // Storage can be unavailable in private browsing or when the quota is exhausted.
  }
}

export function updateAudioSettings(
  current: AudioSettings,
  patch: Partial<Omit<AudioSettings, "version">>
): AudioSettings {
  const accentChanged = patch.accent !== undefined && patch.accent !== current.accent;
  return normalizeAudioSettings({
    ...current,
    ...patch,
    voiceURI: accentChanged
      ? null
      : patch.voiceURI !== undefined
        ? patch.voiceURI
        : current.voiceURI
  });
}
