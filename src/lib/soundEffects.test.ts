import { beforeEach, describe, expect, it, vi } from "vitest";

import { SoundEffectsManager } from "@/lib/soundEffects";

function createAudioParam() {
  return {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn()
  };
}

function createAudioContext(state: AudioContextState = "running") {
  const oscillators: Array<{
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    frequency: ReturnType<typeof createAudioParam>;
    type: OscillatorType;
    onended: (() => void) | null;
  }> = [];
  const gains: Array<{ connect: ReturnType<typeof vi.fn>; gain: ReturnType<typeof createAudioParam> }> = [];
  const context = {
    state,
    currentTime: 10,
    sampleRate: 44_100,
    destination: {},
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    close: vi.fn(async () => undefined),
    createGain: vi.fn(() => {
      const gain = { connect: vi.fn(), gain: createAudioParam() };
      gains.push(gain);
      return gain;
    }),
    createOscillator: vi.fn(() => {
      const oscillator = {
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: createAudioParam(),
        type: "sine" as OscillatorType,
        onended: null as (() => void) | null
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createBuffer: vi.fn((_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length)
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null
    })),
    createBiquadFilter: vi.fn(() => ({
      type: "lowpass" as BiquadFilterType,
      frequency: createAudioParam(),
      Q: createAudioParam(),
      connect: vi.fn()
    }))
  };
  return { context, oscillators, gains };
}

describe("SoundEffectsManager", () => {
  let now: number;

  beforeEach(() => {
    now = 1_000;
  });

  it("does not initialize or play when sound effects are disabled", async () => {
    const factory = vi.fn(() => createAudioContext().context as unknown as AudioContext);
    const manager = new SoundEffectsManager(factory, () => now);
    manager.configure({ enabled: false, volume: 0.35 });

    await expect(manager.play("correct")).resolves.toBe("disabled");
    expect(factory).not.toHaveBeenCalled();
  });

  it("synthesizes the requested effect with one reusable context", async () => {
    const fake = createAudioContext();
    const factory = vi.fn(() => fake.context as unknown as AudioContext);
    const manager = new SoundEffectsManager(factory, () => now);

    await expect(manager.play("correct")).resolves.toBe("played");
    now += 300;
    await expect(manager.play("incorrect")).resolves.toBe("played");

    expect(factory).toHaveBeenCalledTimes(1);
    expect(fake.context.createOscillator).toHaveBeenCalledTimes(3);
    expect(fake.oscillators.every((oscillator) => oscillator.start.mock.calls.length === 1)).toBe(true);
  });

  it("gracefully reports an unsupported Web Audio API", async () => {
    const manager = new SoundEffectsManager(() => null, () => now);

    await expect(manager.play("complete")).resolves.toBe("unsupported");
  });

  it("resumes a suspended context before playback", async () => {
    const fake = createAudioContext("suspended");
    const manager = new SoundEffectsManager(
      () => fake.context as unknown as AudioContext,
      () => now
    );

    await expect(manager.play("card-flip")).resolves.toBe("played");
    expect(fake.context.resume).toHaveBeenCalledTimes(1);
    expect(fake.context.createBufferSource).toHaveBeenCalledTimes(1);
  });

  it("throttles rapid duplicate playback", async () => {
    const fake = createAudioContext();
    const manager = new SoundEffectsManager(
      () => fake.context as unknown as AudioContext,
      () => now
    );

    await expect(manager.play("correct")).resolves.toBe("played");
    now += 100;
    await expect(manager.play("correct")).resolves.toBe("throttled");

    expect(fake.context.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("reserves cooldown before a suspended context finishes resuming", async () => {
    const fake = createAudioContext("suspended");
    const finishResumes: Array<() => void> = [];
    fake.context.resume.mockImplementation(() => new Promise<void>((resolve) => {
      finishResumes.push(() => {
        fake.context.state = "running";
        resolve();
      });
    }));
    const manager = new SoundEffectsManager(
      () => fake.context as unknown as AudioContext,
      () => now
    );

    const first = manager.play("correct");
    const second = manager.play("correct");
    finishResumes.forEach((finishResume) => finishResume());

    await expect(Promise.all([first, second])).resolves.toEqual(["played", "throttled"]);
    expect(fake.context.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("mutes the master gain immediately when effects are disabled", async () => {
    const fake = createAudioContext();
    const manager = new SoundEffectsManager(
      () => fake.context as unknown as AudioContext,
      () => now
    );
    await manager.play("correct");

    manager.configure({ enabled: false, volume: 0.35 });

    expect(fake.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 10, 0.015);
  });
});
