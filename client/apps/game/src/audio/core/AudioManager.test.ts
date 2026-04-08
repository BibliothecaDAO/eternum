// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AudioCategory, type AudioAsset } from "../types";
import { AudioManager } from "./AudioManager";

class FakeAudioParam {
  value = 1;

  cancelScheduledValues() {}

  setValueAtTime(value: number) {
    this.value = value;
  }

  linearRampToValueAtTime(value: number) {
    this.value = value;
  }
}

class FakeGainNode {
  gain = new FakeAudioParam();

  connect() {}

  disconnect() {}
}

class FakeAudioBufferSourceNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  private listeners = new Map<string, Set<() => void>>();

  connect() {}

  disconnect() {}

  start() {}

  stop() {
    this.onended?.();
    this.listeners.get("ended")?.forEach((listener) => listener());
  }

  addEventListener(event: string, listener: () => void) {
    const listeners = this.listeners.get(event) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
  }
}

class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  destination = {};

  createGain() {
    return new FakeGainNode() as unknown as GainNode;
  }

  createBufferSource() {
    return new FakeAudioBufferSourceNode() as unknown as AudioBufferSourceNode;
  }

  async resume() {}

  async close() {}

  async decodeAudioData() {
    return {} as AudioBuffer;
  }
}

const TEST_ASSET: AudioAsset = {
  id: "ui.test_click",
  url: "/sound/ui/test_click.wav",
  category: AudioCategory.UI,
  priority: 8,
  poolSize: 1,
  spatial: false,
  loop: false,
  volume: 0.7,
};

const createStorage = () => {
  const storage = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
  };
};

describe("AudioManager mixing", () => {
  beforeEach(() => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
    );
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    AudioManager.getInstance().dispose();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the per-play gain for the source volume and the category node for category scaling", async () => {
    const manager = AudioManager.getInstance();
    await manager.initialize();
    manager.registerAsset(TEST_ASSET);

    const source = await manager.play(TEST_ASSET.id);

    expect(source).not.toBeNull();

    const sourceGainNode = (manager as any).sourceGainNodes.get(source);
    const categoryGainNode = (manager as any).categoryGainNodes.get(AudioCategory.UI);

    expect(sourceGainNode.gain.value).toBe(TEST_ASSET.volume);
    expect(categoryGainNode.gain.value).toBe(manager.getState().categoryVolumes[AudioCategory.UI]);
  });

  it("starts from the rebalanced category defaults", () => {
    const manager = AudioManager.getInstance();

    expect(manager.getState()).toMatchObject({
      masterVolume: 1,
      muted: false,
      categoryVolumes: {
        [AudioCategory.MUSIC]: 0.08,
        [AudioCategory.UI]: 0.2,
        [AudioCategory.RESOURCE]: 0.25,
        [AudioCategory.BUILDING]: 0.2,
        [AudioCategory.COMBAT]: 0.1,
        [AudioCategory.AMBIENT]: 0.15,
        [AudioCategory.ENVIRONMENT]: 0.2,
      },
    });
  });

  it("keeps the source gain at the asset volume when the category slider changes", async () => {
    const manager = AudioManager.getInstance();
    await manager.initialize();
    manager.registerAsset(TEST_ASSET);

    const source = await manager.play(TEST_ASSET.id);

    expect(source).not.toBeNull();

    manager.setCategoryVolume(AudioCategory.UI, 0.25);

    const sourceGainNode = (manager as any).sourceGainNodes.get(source);
    const categoryGainNode = (manager as any).categoryGainNodes.get(AudioCategory.UI);

    expect(sourceGainNode.gain.value).toBe(TEST_ASSET.volume);
    expect(categoryGainNode.gain.value).toBe(0.25);
  });
});
