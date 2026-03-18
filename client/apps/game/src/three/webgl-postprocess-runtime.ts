import {
  BloomEffect,
  BrightnessContrastEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  HueSaturationEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import { HalfFloatType, type Camera, type Scene, UnsignedByteType, Vector2, WebGLRenderer } from "three";

import type { RendererSurfaceLike } from "./renderer-backend";
import {
  type RendererFramePipeline,
  type RendererPostProcessController,
  type RendererPostProcessPlan,
  type RendererPostProcessRuntime,
} from "./renderer-backend-v2";
import { renderRendererOverlayPasses } from "./renderer-overlay-passes";
import { syncRenderPassScene } from "./renderer-pass-scene";

export function createWebGLPostProcessRuntime(input: {
  isMobileDevice: boolean;
  renderer: RendererSurfaceLike;
}): RendererPostProcessRuntime {
  return new WebGLPostProcessRuntime(input.renderer, input.isMobileDevice);
}

class WebGLPostProcessRuntime implements RendererPostProcessRuntime {
  private readonly composer: EffectComposer;
  private renderPass?: RenderPass;
  private effectPass?: EffectPass;
  private activeCamera?: Camera;
  private postProcessPlan?: RendererPostProcessPlan;
  private hueSaturationEffect?: HueSaturationEffect;
  private brightnessContrastEffect?: BrightnessContrastEffect;
  private vignetteEffect?: VignetteEffect;
  private readonly postProcessController: RendererPostProcessController = {
    setColorGrade: (input) => {
      if (!this.postProcessPlan) {
        return;
      }

      this.postProcessPlan.colorGrade = {
        ...this.postProcessPlan.colorGrade,
        ...input,
      };

      if (this.hueSaturationEffect) {
        const hueSaturation = this.hueSaturationEffect as unknown as { hue: number; saturation: number };
        if (typeof input.hue === "number") {
          hueSaturation.hue = input.hue;
        }
        if (typeof input.saturation === "number") {
          hueSaturation.saturation = input.saturation;
        }
      }

      if (this.brightnessContrastEffect) {
        const brightnessContrast = this.brightnessContrastEffect as unknown as { brightness: number; contrast: number };
        if (typeof input.brightness === "number") {
          brightnessContrast.brightness = input.brightness;
        }
        if (typeof input.contrast === "number") {
          brightnessContrast.contrast = input.contrast;
        }
      }
    },
    setVignette: (input) => {
      if (!this.postProcessPlan) {
        return;
      }

      this.postProcessPlan.vignette = {
        ...this.postProcessPlan.vignette,
        ...input,
      };

      if (this.vignetteEffect) {
        if (typeof input.darkness === "number") {
          this.vignetteEffect.darkness = input.darkness;
        }
        if (typeof input.offset === "number") {
          this.vignetteEffect.offset = input.offset;
        }
      }
    },
  };

  constructor(
    private readonly renderer: RendererSurfaceLike,
    isMobileDevice: boolean,
  ) {
    const frameBufferType = isMobileDevice ? UnsignedByteType : HalfFloatType;
    this.composer = new EffectComposer(this.renderer as unknown as WebGLRenderer, {
      frameBufferType,
    });
  }

  setPlan(plan: RendererPostProcessPlan): RendererPostProcessController {
    this.postProcessPlan = {
      antiAlias: plan.antiAlias,
      bloom: { ...plan.bloom },
      chromaticAberration: { ...plan.chromaticAberration },
      colorGrade: { ...plan.colorGrade },
      toneMapping: { ...plan.toneMapping },
      vignette: { ...plan.vignette },
    };

    this.rebuildEffectPass();
    return this.postProcessController;
  }

  renderFrame(pipeline: RendererFramePipeline): void {
    this.renderer.info.reset();
    this.renderer.clear();

    this.ensureRenderPass(pipeline.mainScene, pipeline.mainCamera);
    this.composer.render();
    renderRendererOverlayPasses(this.renderer, pipeline);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  dispose(): void {
    this.effectPass?.dispose();
    this.effectPass = undefined;
    this.renderPass = undefined;
    this.composer.dispose();
  }

  private ensureRenderPass(scene: Scene, camera: Camera): void {
    this.activeCamera = camera;

    if (!this.renderPass) {
      this.renderPass = new RenderPass(scene, camera);
      this.composer.addPass(this.renderPass);
      this.rebuildEffectPass();
      return;
    }

    syncRenderPassScene(this.renderPass as unknown as { mainScene?: unknown; scene?: unknown }, scene);
    (this.renderPass as unknown as { camera?: Camera }).camera = camera;
  }

  private rebuildEffectPass(): void {
    if (this.effectPass) {
      this.removeComposerPass(this.effectPass);
      this.effectPass.dispose();
      this.effectPass = undefined;
    }

    this.hueSaturationEffect = undefined;
    this.brightnessContrastEffect = undefined;
    this.vignetteEffect = undefined;

    if (!this.postProcessPlan || !this.activeCamera) {
      return;
    }

    const effects = [];

    const toneMappingEffect = new ToneMappingEffect({
      mode: this.resolveToneMappingMode(this.postProcessPlan.toneMapping.mode),
    });
    const mutableToneMapping = toneMappingEffect as unknown as { exposure: number; whitePoint: number };
    mutableToneMapping.exposure = this.postProcessPlan.toneMapping.exposure;
    mutableToneMapping.whitePoint = this.postProcessPlan.toneMapping.whitePoint;
    effects.push(toneMappingEffect);

    this.hueSaturationEffect = new HueSaturationEffect({
      hue: this.postProcessPlan.colorGrade.hue,
      saturation: this.postProcessPlan.colorGrade.saturation,
    });
    effects.push(this.hueSaturationEffect);

    this.brightnessContrastEffect = new BrightnessContrastEffect({
      brightness: this.postProcessPlan.colorGrade.brightness,
      contrast: this.postProcessPlan.colorGrade.contrast,
    });
    effects.push(this.brightnessContrastEffect);

    if (this.postProcessPlan.antiAlias === "fxaa") {
      effects.push(new FXAAEffect());
    }

    if (this.postProcessPlan.bloom.enabled) {
      effects.push(
        new BloomEffect({
          intensity: this.postProcessPlan.bloom.intensity,
          luminanceThreshold: 1.1,
          mipmapBlur: true,
        }),
      );
    }

    if (this.postProcessPlan.vignette.enabled) {
      this.vignetteEffect = new VignetteEffect({
        darkness: this.postProcessPlan.vignette.darkness,
        offset: this.postProcessPlan.vignette.offset,
      });
      effects.push(this.vignetteEffect);
    }

    if (this.postProcessPlan.chromaticAberration.enabled) {
      effects.push(
        new ChromaticAberrationEffect({
          modulationOffset: 0.3,
          offset: new Vector2(0.0008, 0.0008),
          radialModulation: true,
        }),
      );
    }

    this.effectPass = new EffectPass(this.activeCamera, ...effects);
    this.composer.addPass(this.effectPass);
  }

  private removeComposerPass(pass: unknown): void {
    const passes = (this.composer as unknown as { passes?: unknown[] }).passes;
    if (!passes) {
      return;
    }

    const index = passes.indexOf(pass);
    if (index !== -1) {
      passes.splice(index, 1);
    }
  }

  private resolveToneMappingMode(mode: RendererPostProcessPlan["toneMapping"]["mode"]): ToneMappingMode {
    switch (mode) {
      case "aces-filmic":
        return ToneMappingMode.ACES_FILMIC;
      case "linear":
        return ToneMappingMode.LINEAR;
      case "neutral":
        return ToneMappingMode.NEUTRAL;
      case "reinhard":
        return ToneMappingMode.REINHARD;
      case "cineon":
      default:
        return ToneMappingMode.OPTIMIZED_CINEON;
    }
  }
}
