import { beforeEach, describe, expect, it, vi } from "vitest";

const composerInstances: Array<{
  addPass: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  passes: unknown[];
  render: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("postprocessing", () => {
  class EffectComposer {
    public readonly passes: unknown[] = [];
    public readonly addPass = vi.fn((pass: unknown) => {
      this.passes.push(pass);
    });
    public readonly dispose = vi.fn();
    public readonly render = vi.fn();
    public readonly setSize = vi.fn();

    constructor() {
      composerInstances.push(this);
    }
  }

  class RenderPass {
    constructor(
      public scene: unknown,
      public camera: unknown,
    ) {}
  }

  class EffectPass {
    public readonly dispose = vi.fn();

    constructor(
      public camera: unknown,
      ..._effects: unknown[]
    ) {}
  }

  class BloomEffect {}
  class BrightnessContrastEffect {
    public brightness = 0;
    public contrast = 0;

    constructor(input: { brightness: number; contrast: number }) {
      this.brightness = input.brightness;
      this.contrast = input.contrast;
    }
  }
  class ChromaticAberrationEffect {}
  class FXAAEffect {}
  class HueSaturationEffect {
    public hue = 0;
    public saturation = 0;

    constructor(input: { hue: number; saturation: number }) {
      this.hue = input.hue;
      this.saturation = input.saturation;
    }
  }
  class ToneMappingEffect {}
  class VignetteEffect {
    public darkness = 0;
    public offset = 0;

    constructor(input: { darkness: number; offset: number }) {
      this.darkness = input.darkness;
      this.offset = input.offset;
    }
  }

  return {
    BloomEffect,
    BrightnessContrastEffect,
    ChromaticAberrationEffect,
    EffectComposer,
    EffectPass,
    FXAAEffect,
    HueSaturationEffect,
    RenderPass,
    ToneMappingEffect,
    ToneMappingMode: {
      ACES_FILMIC: 1,
      LINEAR: 2,
      NEUTRAL: 3,
      OPTIMIZED_CINEON: 4,
      REINHARD: 5,
    },
    VignetteEffect,
  };
});

import { createWebGLPostProcessRuntime } from "./webgl-postprocess-runtime";

describe("createWebGLPostProcessRuntime", () => {
  beforeEach(() => {
    composerInstances.length = 0;
  });

  it("renders overlay passes after the composer output with depth clears between passes", () => {
    const renderer = {
      clear: vi.fn(),
      clearDepth: vi.fn(),
      info: {
        reset: vi.fn(),
      },
      render: vi.fn(),
    };

    const runtime = createWebGLPostProcessRuntime({
      isMobileDevice: false,
      renderer: renderer as never,
    });

    runtime.renderFrame({
      mainCamera: { id: "main-camera" } as never,
      mainScene: { id: "main-scene" } as never,
      overlayPasses: [
        {
          camera: { id: "interaction-camera" } as never,
          scene: { id: "interaction-scene" } as never,
        },
        {
          camera: { id: "hud-camera" } as never,
          scene: { id: "hud-scene" } as never,
        },
      ],
    });

    expect(renderer.info.reset).toHaveBeenCalledTimes(1);
    expect(renderer.clear).toHaveBeenCalledTimes(1);
    expect(composerInstances[0]?.render).toHaveBeenCalledTimes(1);
    expect(renderer.clearDepth).toHaveBeenCalledTimes(2);
    expect(renderer.render).toHaveBeenNthCalledWith(1, { id: "interaction-scene" }, { id: "interaction-camera" });
    expect(renderer.render).toHaveBeenNthCalledWith(2, { id: "hud-scene" }, { id: "hud-camera" });
  });
});
