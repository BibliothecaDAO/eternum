import { HexPosition, ResourcesIds } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { getWorldPositionForHex } from "../utils";
import { FXManager } from "./fx-manager";

interface ResourceFXOptions {
  labelText?: string;
  duration?: number;
  size?: number;
  floatHeight?: number;
  fadeOutDuration?: number;
}

class ResourceFXInstance {
  public group: THREE.Group;
  public sprite: THREE.Sprite;
  public material: THREE.SpriteMaterial;
  public clock: THREE.Clock;
  public animationFrameId?: number;
  public isDestroyed = false;
  public initialY: number;
  public baseSize: number;
  public resolvePromise?: () => void;
  public label?: CSS2DObject;
  public amountLabel: CSS2DObject;
  public resourceId: number;
  public amount: number;
  private isEnding: boolean = false;
  private endStartTime: number = 0;
  private endDuration: number = 0.5; // Duration of fade out in seconds
  private floatHeight: number;
  private duration: number;

  constructor(
    scene: THREE.Scene,
    texture: THREE.Texture,
    resourceId: number,
    amount: number,
    x: number,
    y: number,
    z: number,
    size: number,
    labelText: string | undefined,
    floatHeight: number = 2.0,
    duration: number = 3.0,
    fadeOutDuration: number = 0.5,
  ) {
    this.clock = new THREE.Clock();
    this.group = new THREE.Group();
    this.group.renderOrder = Infinity;
    this.group.position.set(x, y, z);
    this.initialY = y;
    this.baseSize = size;
    this.resourceId = resourceId;
    this.amount = amount;
    this.floatHeight = floatHeight;
    this.duration = duration;
    this.endDuration = fadeOutDuration;

    this.material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(size, size, size);
    this.group.add(this.sprite);

    // Create resource amount label
    const amountDiv = document.createElement("div");
    amountDiv.className = "resource-fx-amount";
    amountDiv.textContent = amount > 0 ? `+${amount}` : `${amount}`;
    amountDiv.style.color = amount > 0 ? "rgb(94, 232, 94)" : "rgb(255, 100, 100)";
    amountDiv.style.fontFamily = "Cinzel";
    amountDiv.style.fontSize = "18px";
    amountDiv.style.fontWeight = "bold";
    amountDiv.style.textShadow = "0 0 5px black";

    this.amountLabel = new CSS2DObject(amountDiv);
    this.amountLabel.position.set(0.8, 0.2, 0);
    this.group.add(this.amountLabel);

    // Create resource name label if provided
    if (labelText) {
      const div = document.createElement("div");
      div.className = "resource-fx-label";
      div.textContent = labelText;
      div.style.color = "rgb(223 170 84)";
      div.style.fontFamily = "Cinzel";
      div.style.fontSize = "14px";
      div.style.fontWeight = "bold";
      div.style.textShadow = "0 0 5px black";

      this.label = new CSS2DObject(div);
      this.label.position.set(0, -1, 0);
      this.group.add(this.label);
    }

    scene.add(this.group);
    this.animate();
  }

  public onComplete(resolve: () => void) {
    this.resolvePromise = resolve;
  }

  public startEnding() {
    if (!this.isEnding) {
      this.isEnding = true;
      this.endStartTime = this.clock.getElapsedTime();
    }
  }

  private animate = () => {
    if (this.isDestroyed) return;

    const elapsed = this.clock.getElapsedTime();

    // Handle ending animation
    if (this.isEnding) {
      const endElapsed = elapsed - this.endStartTime;
      if (endElapsed < this.endDuration) {
        // Fade out
        const fadeProgress = endElapsed / this.endDuration;
        this.material.opacity = 1 - fadeProgress;

        // Move up during fade out
        const moveUp = fadeProgress * 0.5;
        this.group.position.y = this.initialY + this.floatHeight + moveUp;

        // Continue animation
        this.animationFrameId = requestAnimationFrame(this.animate);
        return;
      } else {
        // End animation complete, destroy the instance
        this.resolvePromise?.();
        this.destroy();
        return;
      }
    }

    // Determine if animation should continue based on time elapsed
    if (elapsed <= this.duration) {
      // Fade in animation (first 0.3 seconds)
      if (elapsed < 0.3) {
        this.material.opacity = elapsed / 0.3;
      } else {
        this.material.opacity = 1;
      }

      // Float upward animation
      const progress = Math.min(elapsed / this.duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease out

      // Position based on progress
      this.group.position.y = this.initialY + this.floatHeight * easeOut;

      // Slight sway for visual interest
      const sway = Math.sin(elapsed * 2) * 0.05;
      this.group.position.x += sway * 0.01;

      this.animationFrameId = requestAnimationFrame(this.animate);
    } else {
      // Start ending automatically when duration is reached
      this.startEnding();
      this.animationFrameId = requestAnimationFrame(this.animate);
    }
  };

  public destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Clean up labels
    if (this.label && this.label.element) {
      this.label.element.remove();
      this.group.remove(this.label);
    }

    if (this.amountLabel && this.amountLabel.element) {
      this.amountLabel.element.remove();
      this.group.remove(this.amountLabel);
    }

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }

    this.material.dispose();
    this.sprite.geometry.dispose();
  }
}

export class ResourceFXManager {
  private scene: THREE.Scene;
  private resourceTextures: Map<number, THREE.Texture> = new Map();
  private inflightLoads: Map<number, Promise<THREE.Texture>> = new Map();
  private activeResourceFX: Set<ResourceFXInstance> = new Set();
  private baseFXManager: FXManager;
  private defaultSize: number;
  private textureLoader: THREE.TextureLoader;

  constructor(scene: THREE.Scene, defaultSize: number = 1.2) {
    this.scene = scene;
    this.defaultSize = defaultSize;
    this.textureLoader = new THREE.TextureLoader();
    this.baseFXManager = new FXManager(scene, defaultSize);
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
        `/images/resources/${resourceId}.png`,
        (loadedTexture) => {
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          loadedTexture.minFilter = THREE.LinearFilter;
          loadedTexture.magFilter = THREE.LinearFilter;
          this.resourceTextures.set(resourceId, loadedTexture);
          this.inflightLoads.delete(resourceId);
          resolve(loadedTexture);
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

  /**
   * Play a resource FX at specific coordinates
   *
   * @param resourceId Resource ID from ResourcesIds
   * @param amount Amount to display (positive or negative)
   * @param x X coordinate
   * @param y Y coordinate
   * @param z Z coordinate
   * @param options Additional options for the effect
   * @returns Promise that resolves when animation completes
   */
  async playResourceFxAtCoords(
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

    let fxInstance: ResourceFXInstance | null = null;
    const promise = new Promise<void>((resolve) => {
      fxInstance = new ResourceFXInstance(
        this.scene,
        texture,
        resourceId,
        amount,
        x,
        y,
        z,
        options.size ?? this.defaultSize,
        options.labelText,
        options.floatHeight,
        options.duration ?? 2.0,
        options.fadeOutDuration ?? 0.5,
      );

      fxInstance.onComplete(resolve);
      this.activeResourceFX.add(fxInstance);

      const cleanup = () => {
        this.activeResourceFX.delete(fxInstance!);
      };

      const originalDestroy = fxInstance.destroy;
      fxInstance.destroy = () => {
        originalDestroy.call(fxInstance);
        cleanup();
      };
    });

    return promise;
  }

  /**
   * Play a resource FX at a hex position
   *
   * @param resourceId Resource ID from ResourcesIds
   * @param amount Amount to display (positive or negative)
   * @param col Hex column
   * @param row Hex row
   * @param text Optional label text to display below the resource
   * @param options Additional options for the effect
   * @returns Promise that resolves when animation completes
   */
  async playResourceFx(
    resourceId: number,
    amount: number,
    col: number,
    row: number,
    text?: string,
    options: ResourceFXOptions = {},
  ): Promise<void> {
    const position = getWorldPositionForHex({ col, row } as HexPosition);
    return this.playResourceFxAtCoords(
      resourceId,
      amount,
      position.x,
      position.y + 2.5, // Position above the hex
      position.z,
      {
        ...options,
        labelText: text ?? options.labelText,
      },
    );
  }

  /**
   * Play multiple resource FX in sequence at the same hex position
   *
   * @param resources Array of {resourceId, amount, text} objects
   * @param col Hex column
   * @param row Hex row
   * @param delay Delay between each resource display (in ms)
   * @param options Additional options for the effects
   */
  async playMultipleResourceFx(
    resources: Array<{ resourceId: number; amount: number; text?: string }>,
    col: number,
    row: number,
    delay: number = 500,
    options: ResourceFXOptions = {},
  ): Promise<void> {
    for (let i = 0; i < resources.length; i++) {
      const { resourceId, amount, text } = resources[i];
      await this.playResourceFx(resourceId, amount, col, row, text, options);

      // Add delay between resources if not the last one
      if (i < resources.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  destroy() {
    this.activeResourceFX.forEach((fx) => fx.destroy());
    this.activeResourceFX.clear();
    this.resourceTextures.forEach((texture) => texture.dispose());
    this.resourceTextures.clear();
    this.baseFXManager.destroy();
  }
}
