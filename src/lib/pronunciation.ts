import type { EnglishAccent } from "@/lib/audioSettings";

export type PronunciationStatus = "idle" | "speaking" | "error";

export type PronunciationVoiceOption = {
  name: string;
  lang: string;
  voiceURI: string;
  default: boolean;
  localService: boolean;
};

export type SpeakOptions = {
  accent?: EnglishAccent;
  rate?: number;
  voiceURI?: string | null;
};

export type PronunciationResult = {
  status: "queued" | "empty" | "unsupported" | "cancelled" | "no-english" | "error";
  requestedAccent: EnglishAccent;
  actualLocale: string | null;
  fallback: boolean;
};

export interface PronunciationEngine {
  getVoices(): PronunciationVoiceOption[];
  subscribeVoices(listener: (voices: PronunciationVoiceOption[]) => void): () => void;
  subscribeStatus(listener: (status: PronunciationStatus) => void): () => void;
  speak(text: string, options?: SpeakOptions): Promise<PronunciationResult>;
  cancel(): void;
}

type UtteranceFactory = (text: string) => SpeechSynthesisUtterance;

function getBrowserSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

function createBrowserUtterance(text: string): SpeechSynthesisUtterance {
  return new SpeechSynthesisUtterance(text);
}

function normalizeLocale(locale: string): string {
  return locale.replace("_", "-").toLowerCase();
}

function isEnglishVoice(voice: SpeechSynthesisVoice): boolean {
  return normalizeLocale(voice.lang).startsWith("en");
}

function selectVoice(
  voices: SpeechSynthesisVoice[],
  accent: EnglishAccent,
  requestedVoiceURI: string | null
): SpeechSynthesisVoice | null {
  const normalizedAccent = normalizeLocale(accent);
  const exactVoices = voices.filter((voice) => normalizeLocale(voice.lang) === normalizedAccent);
  const explicitlySelected = requestedVoiceURI
    ? exactVoices.find((voice) => voice.voiceURI === requestedVoiceURI)
    : undefined;
  if (explicitlySelected) return explicitlySelected;
  if (exactVoices.length > 0) {
    return exactVoices.find((voice) => voice.default)
      ?? exactVoices.find((voice) => voice.localService)
      ?? exactVoices[0];
  }

  const englishVoices = voices.filter(isEnglishVoice);
  return englishVoices.find((voice) => voice.default)
    ?? englishVoices.find((voice) => voice.localService)
    ?? englishVoices[0]
    ?? null;
}

function toVoiceOption(voice: SpeechSynthesisVoice): PronunciationVoiceOption {
  return {
    name: voice.name,
    lang: voice.lang,
    voiceURI: voice.voiceURI,
    default: voice.default,
    localService: voice.localService
  };
}

export class BrowserPronunciationEngine implements PronunciationEngine {
  private readonly voiceListeners = new Set<(voices: PronunciationVoiceOption[]) => void>();
  private readonly statusListeners = new Set<(status: PronunciationStatus) => void>();
  private status: PronunciationStatus = "idle";
  private requestId = 0;
  private voiceListenerAttached = false;
  private readonly handleVoicesChanged = () => {
    const voices = this.getVoices();
    this.voiceListeners.forEach((listener) => listener(voices));
  };

  constructor(
    private readonly synthesis: SpeechSynthesis | null = getBrowserSpeechSynthesis(),
    private readonly utteranceFactory: UtteranceFactory | null = createBrowserUtterance
  ) {}

  getVoices(): PronunciationVoiceOption[] {
    if (!this.synthesis) return [];
    try {
      return this.synthesis.getVoices().map(toVoiceOption);
    } catch {
      return [];
    }
  }

  subscribeVoices(listener: (voices: PronunciationVoiceOption[]) => void): () => void {
    this.voiceListeners.add(listener);
    this.attachVoiceListener();
    listener(this.getVoices());
    return () => {
      this.voiceListeners.delete(listener);
      if (this.voiceListeners.size === 0) this.detachVoiceListener();
    };
  }

  subscribeStatus(listener: (status: PronunciationStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<PronunciationResult> {
    const accent = options.accent ?? "en-US";
    const normalizedText = text.trim();
    if (!normalizedText) return this.result("empty", accent);
    if (!this.synthesis || !this.utteranceFactory) return this.result("unsupported", accent);

    const currentRequestId = ++this.requestId;
    this.synthesis.cancel();
    this.setStatus("idle");

    const voices = await this.waitForNativeVoices();
    if (currentRequestId !== this.requestId) return this.result("cancelled", accent);

    const selectedVoice = selectVoice(voices, accent, options.voiceURI ?? null);
    if (voices.length > 0 && !selectedVoice) return this.result("no-english", accent);

    const utterance = this.utteranceFactory(normalizedText);
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice?.lang ?? accent;
    utterance.rate = Math.min(1.25, Math.max(0.5, options.rate ?? 0.9));
    utterance.pitch = 1;
    utterance.onstart = () => {
      if (currentRequestId === this.requestId) this.setStatus("speaking");
    };
    utterance.onend = () => {
      if (currentRequestId === this.requestId) this.setStatus("idle");
    };
    utterance.onerror = () => {
      if (currentRequestId === this.requestId) this.setStatus("error");
    };

    try {
      this.synthesis.speak(utterance);
    } catch {
      this.setStatus("error");
      return this.result("error", accent);
    }

    const actualLocale = selectedVoice?.lang ?? null;
    return {
      status: "queued",
      requestedAccent: accent,
      actualLocale,
      fallback: actualLocale === null || normalizeLocale(actualLocale) !== normalizeLocale(accent)
    };
  }

  cancel(): void {
    this.requestId += 1;
    try {
      this.synthesis?.cancel();
    } catch {
      // Cancellation is best-effort across browser speech implementations.
    }
    this.setStatus("idle");
  }

  private result(
    status: PronunciationResult["status"],
    accent: EnglishAccent
  ): PronunciationResult {
    return {
      status,
      requestedAccent: accent,
      actualLocale: null,
      fallback: true
    };
  }

  private setStatus(status: PronunciationStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private attachVoiceListener(): void {
    if (!this.synthesis || this.voiceListenerAttached) return;
    this.synthesis.addEventListener("voiceschanged", this.handleVoicesChanged);
    this.voiceListenerAttached = true;
  }

  private detachVoiceListener(): void {
    if (!this.synthesis || !this.voiceListenerAttached) return;
    this.synthesis.removeEventListener("voiceschanged", this.handleVoicesChanged);
    this.voiceListenerAttached = false;
  }

  private waitForNativeVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!this.synthesis) return Promise.resolve([]);
    const currentVoices = this.synthesis.getVoices();
    if (currentVoices.length > 0) return Promise.resolve(currentVoices);

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.synthesis?.removeEventListener("voiceschanged", handleVoices);
        resolve(this.synthesis?.getVoices() ?? []);
      };
      const handleVoices = () => finish();
      const timeoutId = setTimeout(finish, 500);
      this.synthesis?.addEventListener("voiceschanged", handleVoices);
    });
  }
}

export const pronunciation = new BrowserPronunciationEngine();
