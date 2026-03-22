import * as THREE from "three";
import {
  createWorldFxBackend,
  type IconFxAnimationRuntime,
  type WorldFxBackend,
  type WorldFxHandle,
} from "../fx/world-fx-backends";
import type { RendererFxCapabilities } from "../renderer-fx-capabilities";
import { snapshotRendererFxCapabilities } from "../renderer-fx-capabilities";

type FXType = "skull" | "compass" | "troopDiff" | string;

interface FXConfig {
  textureUrl: string;
  animate: (fx: IconFxAnimationRuntime, elapsed: number) => boolean;
  isInfinite?: boolean;
}

interface FXManagerOptions {
  backendFactory?: typeof createWorldFxBackend;
  capabilities?: RendererFxCapabilities;
}

export class FXManager {
  private readonly backend: WorldFxBackend;
  private readonly defaultSize: number;
  private readonly fxConfigs: Map<FXType, FXConfig> = new Map();
  private readonly scene: THREE.Scene;
  private readonly textures: Map<string, THREE.Texture> = new Map();
  private readonly activeLabelFx: Set<WorldFxHandle> = new Set();

  constructor(scene: THREE.Scene, defaultSize: number = 1.5, options: FXManagerOptions = {}) {
    this.scene = scene;
    this.defaultSize = defaultSize;
    this.backend = (options.backendFactory ?? createWorldFxBackend)({
      capabilities: options.capabilities ?? snapshotRendererFxCapabilities(),
      scene,
    });
    this.registerBuiltInFX();
  }

  public update(deltaTime: number): void {
    this.backend.update(deltaTime);
  }

  public hasActiveLabelFx(): boolean {
    return this.activeLabelFx.size > 0;
  }

  public ensureInfiniteIconFx(type: FXType, textureUrl: string, options?: { renderMode?: string }): void {
    if (this.fxConfigs.has(type)) return;
    this.registerFX(type, {
      textureUrl,
      animate: (fx, t) => {
        const fadeIn = Math.min(t / 0.25, 1);
        fx.setOpacity(fadeIn);
        const pulse = 1 + Math.sin(t * 3.2) * 0.04;
        fx.setScale(fx.baseSize * pulse, fx.baseSize * pulse, fx.baseSize * pulse);
        return true;
      },
      isInfinite: true,
    });
  }

  public playFxAtCoords(
    type: FXType,
    x: number,
    y: number,
    z: number,
    size?: number,
    labelText?: string,
    isInfinite: boolean = false,
  ): { promise: Promise<void>; end: () => void; instance?: WorldFxHandle } {
    const config = this.fxConfigs.get(type);
    if (!config) {
      console.warn(`FX type '${type}' is not registered.`);
      return {
        end: () => {},
        instance: undefined,
        promise: Promise.reject(`FX type '${type}' not registered.`),
      };
    }

    const texture = this.textures.get(config.textureUrl);
    if (!texture) {
      console.warn("Texture not registered for FX");
      return {
        end: () => {},
        instance: undefined,
        promise: Promise.reject("Texture not registered"),
      };
    }

    const handle = this.backend.spawnIconFx({
      animate: config.animate,
      animateLabelDots: Boolean(labelText),
      isInfinite: isInfinite || config.isInfinite,
      labelText,
      size: size ?? this.defaultSize,
      texture,
      type,
      x,
      y,
      z,
    });

    return {
      end: () => {
        handle.end();
      },
      instance: handle,
      promise: handle.promise,
    };
  }

  public playTroopDiffFx(diff: number, x: number, y: number, z: number): Promise<void> {
    if (diff === 0) {
      return Promise.resolve();
    }

    const handle = this.backend.spawnTextFx({
      color: diff > 0 ? "rgb(94, 232, 94)" : "rgb(255, 80, 80)",
      text: diff > 0 ? `+${diff}` : `${diff}`,
      x,
      y,
      z,
    });

    this.activeLabelFx.add(handle);
    void handle.promise.finally(() => {
      this.activeLabelFx.delete(handle);
    });

    return handle.promise;
  }

  public destroy(): void {
    this.activeLabelFx.clear();
    this.backend.destroy();
    this.textures.forEach((texture) => {
      texture.dispose();
    });
    this.textures.clear();
  }

  private registerBuiltInFX(): void {
    this.registerFX("skull", {
      animate: (fx, t) => {
        const hoverHeight = 1.5;

        if (t < 0.2) {
          const progress = t / 0.2;
          fx.setOpacity(progress);
          fx.setScale(fx.baseSize * progress, fx.baseSize * progress, fx.baseSize * progress);
        } else if (t < 1.5) {
          const hover = Math.sin((t - 0.2) * Math.PI * 2) * 0.1;
          fx.setPosition(fx.initialX, fx.initialY + hover, fx.initialZ);
          fx.setOpacity(1);
          fx.setScale(fx.baseSize, fx.baseSize, fx.baseSize);
        } else if (t < 2.5) {
          const progress = (t - 1.5) / 1.0;
          fx.setPosition(fx.initialX, fx.initialY + hoverHeight * progress, fx.initialZ);
          fx.setOpacity(1 - progress);
        } else {
          return false;
        }

        return true;
      },
      textureUrl: "textures/skull.png",
    });

    this.registerFX("compass", {
      animate: (fx, t) => {
        fx.setOpacity(t < 0.3 ? t / 0.3 : 1);
        fx.setRotation(t * 2);
        return true;
      },
      textureUrl: "textures/compass.png",
    });

    this.registerFX("travel", {
      animate: (fx, t) => {
        fx.setOpacity(t < 0.3 ? t / 0.3 : 1);

        const cycle = t % 3.0;
        const bob = Math.sin(cycle * Math.PI * 2) * 0.05;
        const sway = Math.sin(cycle * Math.PI) * 0.05;
        fx.setPosition(fx.initialX + sway * 0.01, fx.initialY + bob, fx.initialZ);
        fx.setScale(fx.baseSize, fx.baseSize, fx.baseSize);

        return true;
      },
      isInfinite: true,
      textureUrl: "textures/travel.png",
    });

    this.registerFX("attack", {
      textureUrl: "textures/attack.png",
      animate: (fx, t) => {
        const fadeIn = Math.min(t / 0.25, 1);
        fx.setOpacity(0.78 * fadeIn);
        const pulse = 1 + Math.sin(t * 4.4) * 0.08;
        fx.setScale(fx.baseSize * pulse, fx.baseSize * pulse, fx.baseSize * pulse);
        return true;
      },
      isInfinite: true,
    });

    this.registerFX("defense", {
      textureUrl: "textures/defense.png",
      animate: (fx, t) => {
        const fadeIn = Math.min(t / 0.25, 1);
        fx.setOpacity(0.72 * fadeIn);
        const pulse = 1 + Math.sin(t * 3.5 + Math.PI * 0.3) * 0.06;
        fx.setScale(fx.baseSize * pulse, fx.baseSize * pulse, fx.baseSize * pulse);
        return true;
      },
      isInfinite: true,
    });
  }

  private registerFX(type: FXType, config: FXConfig): void {
    if (!this.textures.has(config.textureUrl)) {
      const texture = new THREE.TextureLoader().load(config.textureUrl);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      this.textures.set(config.textureUrl, texture);
    }

    this.fxConfigs.set(type, config);
  }
}
