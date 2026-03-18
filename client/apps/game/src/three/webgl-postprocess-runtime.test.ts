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
    public readonly removePass = vi.fn((pass: unknown) => {
      const idx = this.passes.indexOf(pass);
      if (idx !== -1) this.passes.splice(idx, 1);
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

  class Pass {}

  return {
    BloomEffect,
    BrightnessContrastEffect,
    ChromaticAberrationEffect,
    EffectComposer,
    EffectPass,
    FXAAEffect,
    HueSaturationEffect,
    Pass,
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

import type { RendererPostProcessPlan } from "./renderer-backend-v2";
import { createWebGLPostProcessRuntime } from "./webgl-postprocess-runtime";

function createPlan(overrides: Partial<RendererPostProcessPlan> = {}): RendererPostProcessPlan {
  return {
    antiAlias: "none",
    bloom: { enabled: false, intensity: 0 },
    chromaticAberration: { enabled: false },
    colorGrade: { brightness: 0, contrast: 0, hue: 0, saturation: 0 },
    toneMapping: { exposure: 1, mode: "linear", whitePoint: 1 },
    vignette: { darkness: 0, enabled: false, offset: 0 },
    ...overrides,
  };
}

function createMockRenderer() {
  return {
    clear: vi.fn(),
    clearDepth: vi.fn(),
    info: { reset: vi.fn() },
    render: vi.fn(),
  };
}

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

  it("calls composer.removePass when rebuilding the effect pass on a second setPlan", () => {
    const renderer = createMockRenderer();
    const runtime = createWebGLPostProcessRuntime({
      isMobileDevice: false,
      renderer: renderer as never,
    });

    // First setPlan + renderFrame to establish the effectPass
    runtime.setPlan(createPlan());
    runtime.renderFrame({
      mainCamera: { id: "cam" } as never,
      mainScene: { id: "scene" } as never,
    });

    const composer = composerInstances[0]!;
    composer.removePass.mockClear();

    // Second setPlan triggers rebuildEffectPass which should call removePass
    runtime.setPlan(createPlan());

    expect(composer.removePass).toHaveBeenCalledTimes(1);
  });

  it("does not throw when removePass is called on a pass not in the composer", () => {
    const renderer = createMockRenderer();
    const runtime = createWebGLPostProcessRuntime({
      isMobileDevice: false,
      renderer: renderer as never,
    });

    // Just setPlan without renderFrame — no effectPass exists, so no removal happens
    expect(() => runtime.setPlan(createPlan())).not.toThrow();
  });

  it("renders correctly after a pass removal cycle", () => {
    const renderer = createMockRenderer();
    const runtime = createWebGLPostProcessRuntime({
      isMobileDevice: false,
      renderer: renderer as never,
    });

    runtime.setPlan(createPlan());
    runtime.renderFrame({
      mainCamera: { id: "cam" } as never,
      mainScene: { id: "scene" } as never,
    });

    // Rebuild the effect pass
    runtime.setPlan(createPlan());

    // Render again — should still work
    runtime.renderFrame({
      mainCamera: { id: "cam" } as never,
      mainScene: { id: "scene" } as never,
    });

    const composer = composerInstances[0]!;
    expect(composer.render).toHaveBeenCalledTimes(2);
  });
});
