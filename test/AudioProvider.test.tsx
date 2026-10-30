// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let statusListener: ((status: "idle" | "speaking" | "error") => void) | undefined;

  return {
    emitStatus: (status: "idle" | "speaking" | "error") => statusListener?.(status),
    subscribeVoices: vi.fn((listener: (voices: never[]) => void) => {
      listener([]);
      return vi.fn();
    }),
    subscribeStatus: vi.fn((listener: (status: "idle" | "speaking" | "error") => void) => {
      statusListener = listener;
      listener("idle");
      return vi.fn();
    }),
    speak: vi.fn(),
    cancel: vi.fn(),
    configure: vi.fn(),
    setSpeechActive: vi.fn(),
    unlock: vi.fn(),
    play: vi.fn(),
    dispose: vi.fn()
  };
});

vi.mock("@/lib/pronunciation", () => ({
  pronunciation: {
    subscribeVoices: mocks.subscribeVoices,
    subscribeStatus: mocks.subscribeStatus,
    speak: mocks.speak,
    cancel: mocks.cancel
  }
}));

vi.mock("@/lib/soundEffects", () => ({
  soundEffects: {
    configure: mocks.configure,
    setSpeechActive: mocks.setSpeechActive,
    unlock: mocks.unlock,
    play: mocks.play,
    dispose: mocks.dispose
  }
}));

import { AudioProvider, useAudioActions, useAudioState } from "@/routes/AudioProvider";

function StateProbe({ onRender }: { onRender: (status: string) => void }) {
  const { pronunciationStatus } = useAudioState();
  onRender(pronunciationStatus);
  return null;
}

function ActionsProbe({ onRender }: { onRender: () => void }) {
  useAudioActions();
  onRender();
  return null;
}

describe("AudioProvider context boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {}
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class SpeechSynthesisUtterance {}
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates state consumers without rerendering action-only consumers on status changes", () => {
    const stateStatuses: string[] = [];
    let actionRenderCount = 0;

    render(
      <MemoryRouter>
        <AudioProvider>
          <StateProbe onRender={(status) => stateStatuses.push(status)} />
          <ActionsProbe onRender={() => { actionRenderCount += 1; }} />
        </AudioProvider>
      </MemoryRouter>
    );

    expect(stateStatuses.length).toBeGreaterThanOrEqual(1);
    expect(stateStatuses.every((status) => status === "idle")).toBe(true);
    expect(actionRenderCount).toBe(1);

    act(() => mocks.emitStatus("speaking"));

    expect(stateStatuses.at(-1)).toBe("speaking");
    expect(actionRenderCount).toBe(1);
  });

  it("requires the focused hooks to be used inside AudioProvider", () => {
    expect(() => render(<StateProbe onRender={() => undefined} />)).toThrow(
      "useAudioState must be used within AudioProvider"
    );
    expect(() => render(<ActionsProbe onRender={() => undefined} />)).toThrow(
      "useAudioActions must be used within AudioProvider"
    );
  });
});
