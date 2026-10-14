export type SoundEffect = "correct" | "incorrect" | "card-flip" | "complete";
export type SoundPlaybackStatus =
  | "played"
  | "disabled"
  | "unsupported"
  | "throttled"
  | "blocked";

type SoundEffectsConfig = {
  enabled: boolean;
  volume: number;
};

type AudioContextFactory = () => AudioContext | null;

const EFFECT_COOLDOWNS: Record<SoundEffect, number> = {
  correct: 250,
  incorrect: 250,
  "card-flip": 120,
  complete: 1_500
};

function createBrowserAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : null;
}

function effectGroup(effect: SoundEffect): string {
  if (effect === "correct" || effect === "incorrect") return "feedback";
  return effect;
}

export class SoundEffectsManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private config: SoundEffectsConfig = { enabled: true, volume: 0.35 };
  private speechActive = false;
  private readonly lastPlayedAt = new Map<SoundEffect, number>();
  private readonly activeSources = new Map<string, Set<AudioScheduledSourceNode>>();

  constructor(
    private readonly contextFactory: AudioContextFactory = createBrowserAudioContext,
    private readonly now: () => number = () => performance.now()
  ) {}

  configure(config: SoundEffectsConfig): void {
    this.config = {
      enabled: config.enabled,
      volume: Math.min(1, Math.max(0, config.volume))
    };
    this.updateMasterVolume();
  }

  setSpeechActive(active: boolean): void {
    this.speechActive = active;
    this.updateMasterVolume();
  }

  async unlock(): Promise<boolean> {
    const context = this.ensureContext();
    if (!context) return false;
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }
    return context.state === "running";
  }

  async play(effect: SoundEffect): Promise<SoundPlaybackStatus> {
    if (!this.config.enabled || this.config.volume === 0) return "disabled";

    const currentTime = this.now();
    const previousTime = this.lastPlayedAt.get(effect);
    if (previousTime !== undefined && currentTime - previousTime < EFFECT_COOLDOWNS[effect]) {
      return "throttled";
    }

    const context = this.ensureContext();
    if (!context) return "unsupported";
    if (!(await this.unlock())) return "blocked";

    this.lastPlayedAt.set(effect, currentTime);
    this.stopGroup(effectGroup(effect));
    try {
      if (effect === "correct") this.playCorrect(context);
      else if (effect === "incorrect") this.playIncorrect(context);
      else if (effect === "card-flip") this.playCardFlip(context);
      else this.playComplete(context);
      return "played";
    } catch {
      return "blocked";
    }
  }

  async dispose(): Promise<void> {
    for (const group of this.activeSources.keys()) this.stopGroup(group);
    const context = this.context;
    this.context = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.lastPlayedAt.clear();
    if (context && context.state !== "closed") {
      try {
        await context.close();
      } catch {
        // The browser owns the device lifecycle; cleanup failure is non-fatal.
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.context?.state === "closed") {
      this.context = null;
      this.masterGain = null;
      this.noiseBuffer = null;
    }
    if (!this.context) {
      try {
        this.context = this.contextFactory();
      } catch {
        this.context = null;
      }
    }
    if (this.context && !this.masterGain) {
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      this.updateMasterVolume();
    }
    return this.context;
  }

  private updateMasterVolume(): void {
    if (!this.context || !this.masterGain) return;
    const ducking = this.speechActive ? 0.35 : 1;
    this.masterGain.gain.setTargetAtTime(
      this.config.volume * ducking,
      this.context.currentTime,
      0.015
    );
  }

  private stopGroup(group: string): void {
    const sources = this.activeSources.get(group);
    if (!sources) return;
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        // A one-shot source may already have ended.
      }
    }
    sources.clear();
  }

  private trackSource(group: string, source: AudioScheduledSourceNode): void {
    const sources = this.activeSources.get(group) ?? new Set<AudioScheduledSourceNode>();
    sources.add(source);
    this.activeSources.set(group, sources);
    source.onended = () => sources.delete(source);
  }

  private scheduleTone(
    context: AudioContext,
    group: string,
    frequency: number,
    startsAt: number,
    duration: number,
    type: OscillatorType,
    peakGain: number
  ): OscillatorNode {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    envelope.gain.setValueAtTime(0.0001, startsAt);
    envelope.gain.exponentialRampToValueAtTime(peakGain, startsAt + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
    oscillator.connect(envelope);
    envelope.connect(this.masterGain!);
    this.trackSource(group, oscillator);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + duration + 0.02);
    return oscillator;
  }

  private playCorrect(context: AudioContext): void {
    const group = effectGroup("correct");
    const start = context.currentTime;
    this.scheduleTone(context, group, 523.25, start, 0.2, "triangle", 0.12);
    this.scheduleTone(context, group, 659.25, start + 0.12, 0.2, "sine", 0.1);
  }

  private playIncorrect(context: AudioContext): void {
    const group = effectGroup("incorrect");
    const start = context.currentTime;
    const oscillator = this.scheduleTone(context, group, 220, start, 0.22, "triangle", 0.09);
    oscillator.frequency.exponentialRampToValueAtTime(174.61, start + 0.22);
  }

  private playCardFlip(context: AudioContext): void {
    if (!this.noiseBuffer) {
      const length = Math.ceil(context.sampleRate * 0.1);
      this.noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const samples = this.noiseBuffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = Math.random() * 2 - 1;
      }
    }

    const start = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.Q.setValueAtTime(0.7, start);
    filter.frequency.setValueAtTime(1_800, start);
    filter.frequency.exponentialRampToValueAtTime(700, start + 0.1);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(0.08, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.masterGain!);
    this.trackSource(effectGroup("card-flip"), source);
    source.start(start);
    source.stop(start + 0.11);
  }

  private playComplete(context: AudioContext): void {
    const group = effectGroup("complete");
    const start = context.currentTime;
    [523.25, 659.25, 783.99, 1_046.5].forEach((frequency, index) => {
      this.scheduleTone(
        context,
        group,
        frequency,
        start + index * 0.12,
        0.28,
        index % 2 === 0 ? "triangle" : "sine",
        0.09
      );
    });
  }
}

export const soundEffects = new SoundEffectsManager();
