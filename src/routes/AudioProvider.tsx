import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useLocation } from "react-router-dom";

import {
  loadAudioSettings,
  saveAudioSettings,
  updateAudioSettings,
  type AudioSettings
} from "@/lib/audioSettings";
import {
  pronunciation,
  type PronunciationResult,
  type PronunciationStatus,
  type PronunciationVoiceOption,
  type SpeakOptions
} from "@/lib/pronunciation";
import { soundEffects, type SoundEffect } from "@/lib/soundEffects";

type VoiceState = "loading" | "ready" | "unsupported";

export type AudioStateContextValue = {
  settings: AudioSettings;
  voices: PronunciationVoiceOption[];
  voiceState: VoiceState;
  pronunciationStatus: PronunciationStatus;
  lastPronunciationResult: PronunciationResult | null;
  updateSettings: (patch: Partial<Omit<AudioSettings, "version">>) => void;
};

export type AudioActionsContextValue = {
  playSound: (effect: SoundEffect) => void;
  speak: (text: string, options?: Omit<SpeakOptions, "accent" | "voiceURI">) => Promise<PronunciationResult>;
  cancelSpeech: () => void;
};

const AudioStateContext = createContext<AudioStateContextValue | null>(null);
const AudioActionsContext = createContext<AudioActionsContextValue | null>(null);

function supportsSpeechSynthesis(): boolean {
  return typeof window !== "undefined"
    && "speechSynthesis" in window
    && "SpeechSynthesisUtterance" in window;
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [settings, setSettings] = useState(loadAudioSettings);
  const [voices, setVoices] = useState<PronunciationVoiceOption[]>([]);
  const [voicesInitialized, setVoicesInitialized] = useState(false);
  const [pronunciationStatus, setPronunciationStatus] = useState<PronunciationStatus>("idle");
  const [lastPronunciationResult, setLastPronunciationResult] = useState<PronunciationResult | null>(null);
  const speechSupported = supportsSpeechSynthesis();

  useEffect(() => {
    soundEffects.configure({
      enabled: settings.soundEffectsEnabled,
      volume: settings.soundEffectsVolume
    });
    saveAudioSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!speechSupported) {
      setVoicesInitialized(true);
      return;
    }
    const timeoutId = window.setTimeout(() => setVoicesInitialized(true), 750);
    const unsubscribeVoices = pronunciation.subscribeVoices((loadedVoices) => {
      setVoices(loadedVoices);
      if (loadedVoices.length > 0) setVoicesInitialized(true);
      setSettings((current) => {
        if (!current.voiceURI || loadedVoices.length === 0) return current;
        const selectedVoiceStillExists = loadedVoices.some(
          (voice) => voice.voiceURI === current.voiceURI && voice.lang.toLowerCase() === current.accent.toLowerCase()
        );
        return selectedVoiceStillExists ? current : updateAudioSettings(current, { voiceURI: null });
      });
    });
    const unsubscribeStatus = pronunciation.subscribeStatus((status) => {
      setPronunciationStatus(status);
      soundEffects.setSpeechActive(status === "speaking");
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribeVoices();
      unsubscribeStatus();
      soundEffects.setSpeechActive(false);
    };
  }, [speechSupported]);

  useEffect(() => {
    if (!settings.soundEffectsEnabled || typeof window === "undefined") return;
    const unlock = () => {
      void soundEffects.unlock();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [settings.soundEffectsEnabled]);

  useEffect(() => () => pronunciation.cancel(), [location.pathname]);

  useEffect(() => () => {
    pronunciation.cancel();
    void soundEffects.dispose();
  }, []);

  const updateSettingsValue = useCallback(
    (patch: Partial<Omit<AudioSettings, "version">>) => {
      if (patch.accent !== undefined || patch.voiceURI !== undefined) {
        setLastPronunciationResult(null);
      }
      setSettings((current) => updateAudioSettings(current, patch));
    },
    []
  );

  const playSound = useCallback((effect: SoundEffect) => {
    void soundEffects.play(effect);
  }, []);

  const speak = useCallback(
    async (text: string, options: Omit<SpeakOptions, "accent" | "voiceURI"> = {}) => {
      const result = await pronunciation.speak(text, {
        ...options,
        accent: settings.accent,
        voiceURI: settings.voiceURI
      });
      setLastPronunciationResult(result);
      return result;
    },
    [settings.accent, settings.voiceURI]
  );

  const cancelSpeech = useCallback(() => pronunciation.cancel(), []);
  const voiceState: VoiceState = !speechSupported
    ? "unsupported"
    : !voicesInitialized
      ? "loading"
      : "ready";

  const stateValue = useMemo<AudioStateContextValue>(
    () => ({
      settings,
      voices,
      voiceState,
      pronunciationStatus,
      lastPronunciationResult,
      updateSettings: updateSettingsValue
    }),
    [
      settings,
      voices,
      voiceState,
      pronunciationStatus,
      lastPronunciationResult,
      updateSettingsValue
    ]
  );

  const actionsValue = useMemo<AudioActionsContextValue>(
    () => ({
      playSound,
      speak,
      cancelSpeech
    }),
    [playSound, speak, cancelSpeech]
  );

  return (
    <AudioStateContext.Provider value={stateValue}>
      <AudioActionsContext.Provider value={actionsValue}>
        {children}
      </AudioActionsContext.Provider>
    </AudioStateContext.Provider>
  );
}

export function useAudioState() {
  const context = useContext(AudioStateContext);
  if (!context) throw new Error("useAudioState must be used within AudioProvider");
  return context;
}

export function useAudioActions() {
  const context = useContext(AudioActionsContext);
  if (!context) throw new Error("useAudioActions must be used within AudioProvider");
  return context;
}

export function useAudio(): AudioStateContextValue & AudioActionsContextValue {
  return {
    ...useAudioState(),
    ...useAudioActions()
  };
}
