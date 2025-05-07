import * as THREE from "three";

class FXInstance {
  private group: THREE.Group;
  private sprite: THREE.Sprite;
  private material: THREE.SpriteMaterial;
  private clock: THREE.Clock;
  private animationFrameId?: number;
  private isDestroyed = false;
  private initialY: number;
  private baseSize: number;
  private resolvePromise?: () => void;

  constructor(scene: THREE.Scene, texture: THREE.Texture, x: number, y: number, z: number, size: number = 1.5) {
    this.clock = new THREE.Clock();
    this.group = new THREE.Group();
    this.group.renderOrder = Infinity;
    this.group.position.set(x, y, z);
    this.initialY = y;
    this.baseSize = size;

    this.material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(size, size, size);
    this.group.add(this.sprite);
    scene.add(this.group);

    this.animate();
  }

  public onComplete(resolve: () => void) {
    this.resolvePromise = resolve;
  }

  private animate = () => {
    if (this.isDestroyed) return;

    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();
    const duration = 2.5;
    const hoverHeight = 1.5;

    // Phase 1: Scale In and Fade In (0–0.2s)
    if (elapsed < 0.2) {
      const f = elapsed / 0.2;
      this.material.opacity = f;
      this.sprite.scale.set(this.baseSize * f, this.baseSize * f, this.baseSize * f);
    }

    // Phase 2: Idle Hover (0.2–1.5s)
    if (elapsed >= 0.2 && elapsed < 1.5) {
      const hover = Math.sin((elapsed - 0.2) * Math.PI * 2) * 0.1;
      this.group.position.y = this.initialY + hover;
      this.material.opacity = 1;
      this.sprite.scale.set(this.baseSize, this.baseSize, this.baseSize);
    }

    // Phase 3: Rise and Fade Out (1.5–2.5s)
    if (elapsed >= 1.5 && elapsed < duration) {
      const f = (elapsed - 1.5) / 1.0;
      this.group.position.y = this.initialY + hoverHeight * f;
      this.material.opacity = 1 - f;
      this.sprite.scale.set(this.baseSize, this.baseSize, this.baseSize);
    }

    if (elapsed >= duration) {
      this.resolvePromise?.();
      this.destroy();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  public destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }

    this.material.dispose();
    this.sprite.geometry.dispose();
  }
}

export class FXManager {
  private scene: THREE.Scene;
  private texture: THREE.Texture;
  private activeFX: Set<FXInstance> = new Set();
  private defaultSize: number;

  constructor(scene: THREE.Scene, textureUrl: string, defaultSize: number = 1.5) {
    this.scene = scene;
    this.defaultSize = defaultSize;

    // Create texture with proper settings
    this.texture = new THREE.TextureLoader().load(textureUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
    });
  }

  playFxAtCoords(x: number, y: number, z: number, size?: number): Promise<void> {
    // Ensure texture is loaded before creating instance
    if (!this.texture.image) {
      console.warn("Texture not loaded yet, skipping FX");
      return Promise.reject("Texture not loaded");
    }

    return new Promise((resolve) => {
      const fxInstance = new FXInstance(this.scene, this.texture, x, y, z, size ?? this.defaultSize);
      fxInstance.onComplete(resolve);
      this.activeFX.add(fxInstance);

      // Clean up the instance from activeFX set when it's destroyed
      const cleanup = () => {
        this.activeFX.delete(fxInstance);
      };

      // Override the destroy method to include cleanup
      const originalDestroy = fxInstance.destroy;
      fxInstance.destroy = () => {
        originalDestroy.call(fxInstance);
        cleanup();
      };
    });
  }

  destroy() {
    // Clean up all active FX instances
    this.activeFX.forEach((fx) => fx.destroy());
    this.activeFX.clear();
    this.texture.dispose();
  }
}
