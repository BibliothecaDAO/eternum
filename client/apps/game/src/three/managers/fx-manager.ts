import * as THREE from "three";

class FXInstance {
  private group: THREE.Group;
  private sprite: THREE.Sprite;
  private material: THREE.SpriteMaterial;
  private clock: THREE.Clock;
  private animationFrameId?: number;
  private isDestroyed = false;
  private initialY: number;

  constructor(scene: THREE.Scene, texture: THREE.Texture, x: number, y: number, z: number) {
    this.clock = new THREE.Clock();
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.initialY = y;

    this.material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(1.5, 1.5, 1.5);
    this.group.add(this.sprite);
    scene.add(this.group);

    this.animate();
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
      this.sprite.scale.set(1.5 * f, 1.5 * f, 1.5 * f);
    }

    // Phase 2: Idle Hover (0.2–1.5s)
    if (elapsed >= 0.2 && elapsed < 1.5) {
      const hover = Math.sin((elapsed - 0.2) * Math.PI * 2) * 0.1;
      this.group.position.y = this.initialY + hover;
      this.material.opacity = 1;
    }

    // Phase 3: Rise and Fade Out (1.5–2.5s)
    if (elapsed >= 1.5 && elapsed < duration) {
      const f = (elapsed - 1.5) / 1.0;
      this.group.position.y = this.initialY + hoverHeight * f;
      this.material.opacity = 1 - f;
    }

    if (elapsed >= duration) {
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

  constructor(scene: THREE.Scene, textureUrl: string) {
    this.scene = scene;
    this.texture = new THREE.TextureLoader().load(textureUrl);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  playFxAtCoords(x: number, y: number, z: number) {
    const fxInstance = new FXInstance(this.scene, this.texture, x, y, z);
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
  }

  destroy() {
    // Clean up all active FX instances
    this.activeFX.forEach((fx) => fx.destroy());
    this.activeFX.clear();
    this.texture.dispose();
  }
}
