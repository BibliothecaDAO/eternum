import { resourceMeaning, iconUrl } from "@/ui/design-system/icon-meaning";
import { formatCharge, formatGain } from "@bibliothecadao/types";
import * as THREE from "three";
import { createWorldFxBackend, type WorldFxBackend, type WorldFxHandle } from "../fx/world-fx-backends";
import type { RendererFxCapabilities } from "../renderer-fx-capabilities";
import { snapshotRendererFxCapabilities } from "../renderer-fx-capabilities";
import { warmTexturePipeline, type PipelineCompiler } from "../pipeline-compiler";

interface ResourceFXOptions {
  labelText?: string;
  duration?: number;
  size?: number;
  floatHeight?: number;
  fadeOutDuration?: number;
}

interface ResourceFXManagerOptions {
  backendFactory?: typeof createWorldFxBackend;
  capabilities?: RendererFxCapabilities;
  compilePipelines?: PipelineCompiler;
}

interface ActiveResourceFx {
  handles: WorldFxHandle[];
}

export class ResourceFXManager {
  private readonly scene: THREE.Scene;
  private readonly resourceTextures: Map<number, THREE.Texture> = new Map();
  private readonly inflightLoads: Map<number, Promise<THREE.Texture>> = new Map();
  private readonly activeResourceFX: Set<ActiveResourceFx> = new Set();
  private readonly defaultSize: number;
  private readonly textureLoader: THREE.TextureLoader;
  private readonly backend: WorldFxBackend;
  private readonly compilePipelines?: PipelineCompiler;
  private destroyed = false;

  constructor(scene: THREE.Scene, defaultSize: number = 1.2, options: ResourceFXManagerOptions = {}) {
    this.scene = scene;
    this.defaultSize = defaultSize;
    this.compilePipelines = options.compilePipelines;
    this.textureLoader = new THREE.TextureLoader();
    this.backend = (options.backendFactory ?? createWorldFxBackend)({
      capabilities: options.capabilities ?? snapshotRendererFxCapabilities(),
      scene,
    });
  }

  public hasActiveFx(): boolean {
    return this.activeResourceFX.size > 0;
  }

  public setVisible(visible: boolean): void {
    this.backend.setVisible(visible);
  }

  public update(deltaTime: number): void {
    this.backend.update(deltaTime);
  }

  public async playResourceFxAtCoords(
    resourceId: number,
    amount: number,
    x: number,
    y: number,
    z: number,
    options: ResourceFXOptions = {},
  ): Promise<void> {
    let texture: THREE.Texture;
    try {
      texture = await this.getOrLoadTexture(resourceId);
    } catch (error) {
      console.warn("Failed to load resource texture, skipping FX", resourceId, error);
      return Promise.reject(error);
    }

    const duration = options.duration ?? 2.0;
    const fadeOutDuration = options.fadeOutDuration ?? 0.5;
    const floatHeight = options.floatHeight ?? 2.0;

    const iconHandle = this.backend.spawnIconFx({
      animate: (fx, elapsed) => {
        if (elapsed < 0.3) {
          fx.setOpacity(elapsed / 0.3);
        } else if (elapsed < duration) {
          fx.setOpacity(1);
        }

        if (elapsed <= duration) {
          const progress = Math.min(elapsed / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3);
          const sway = Math.sin(elapsed * 2) * 0.0005;
          fx.setPosition(fx.initialX + sway, fx.initialY + floatHeight * easeOut, fx.initialZ);
          return true;
        }

        if (elapsed <= duration + fadeOutDuration) {
          const fadeProgress = (elapsed - duration) / fadeOutDuration;
          fx.setOpacity(1 - fadeProgress);
          fx.setPosition(fx.initialX, fx.initialY + floatHeight + fadeProgress * 0.5, fx.initialZ);
          return true;
        }

        return false;
      },
      animateLabelDots: false,
      labelText: options.labelText,
      size: options.size ?? this.defaultSize,
      texture,
      type: `resource-${resourceId}`,
      x,
      y,
      z,
    });

    const amountHandle = this.backend.spawnTextFx({
      color: amount > 0 ? "rgb(94, 232, 94)" : "rgb(255, 100, 100)",
      duration,
      fadeOutDuration,
      floatHeight,
      floatRight: 0.9,
      fontSize: "18px",
      text: amount > 0 ? formatGain(amount) : formatCharge(amount),
      x: x + 0.8,
      y: y + 0.2,
      z,
    });

    const activeFx: ActiveResourceFx = {
      handles: [iconHandle, amountHandle],
    };
    this.activeResourceFX.add(activeFx);

    const promise = Promise.all(activeFx.handles.map((handle) => handle.promise)).then(() => {});
    void promise.finally(() => {
      this.activeResourceFX.delete(activeFx);
    });

    return promise;
  }

  public destroy(): void {
    this.destroyed = true;
    this.activeResourceFX.clear();
    this.backend.destroy();
    this.resourceTextures.forEach((texture) => {
      texture.dispose();
    });
    this.resourceTextures.clear();
  }

  private getOrLoadTexture(resourceId: number): Promise<THREE.Texture> {
    const cached = this.resourceTextures.get(resourceId);
    if (cached) {
      return Promise.resolve(cached);
    }

    const inflight = this.inflightLoads.get(resourceId);
    if (inflight) {
      return inflight;
    }

    const loadPromise = new Promise<THREE.Texture>((resolve, reject) => {
      this.textureLoader.load(
        iconUrl(resourceMeaning(resourceId)),
        (loadedTexture) => {
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          loadedTexture.minFilter = THREE.LinearFilter;
          loadedTexture.magFilter = THREE.LinearFilter;
          const finish = () => {
            this.inflightLoads.delete(resourceId);
            if (this.destroyed) {
              loadedTexture.dispose();
              reject(new Error("ResourceFXManager destroyed"));
              return;
            }
            this.resourceTextures.set(resourceId, loadedTexture);
            resolve(loadedTexture);
          };
          if (!this.compilePipelines) {
            finish();
            return;
          }
          void warmTexturePipeline(this.compilePipelines, this.scene, loadedTexture)
            .catch(() => undefined)
            .finally(finish);
        },
        undefined,
        (error) => {
          console.error(`Failed to load texture for resource ${resourceId}:`, error);
          this.inflightLoads.delete(resourceId);
          reject(error);
        },
      );
    });

    this.inflightLoads.set(resourceId, loadPromise);
    return loadPromise;
  }
}
