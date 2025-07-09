import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

type FXType = "skull" | "compass" | string;

interface FXConfig {
  textureUrl: string;
  animate: (fx: FXInstance, elapsed: number) => boolean; // return false to stop
  isInfinite?: boolean; // if true, effect will continue until manually stopped
}

// -------------------- FXInstance --------------------
class FXInstance {
  public group: THREE.Group;
  public sprite: THREE.Sprite;
  public material: THREE.SpriteMaterial;
  public clock: THREE.Clock;
  public animationFrameId?: number;
  public isDestroyed = false;
  public initialX: number;
  public initialY: number;
  public initialZ: number;
  public baseSize: number;
  public resolvePromise?: () => void;
  public label?: CSS2DObject;
  public labelBaseText?: string;
  public type: FXType;
  public animateCallback: (fx: FXInstance, elapsed: number) => boolean;
  public isInfinite: boolean;
  private isEnding: boolean = false;
  private endStartTime: number = 0;
  private endDuration: number = 0.5; // Duration of fade out in seconds

  constructor(
    scene: THREE.Scene,
    texture: THREE.Texture,
    type: FXType,
    x: number,
    y: number,
    z: number,
    size: number,
    labelText: string | undefined,
    animateCallback: (fx: FXInstance, elapsed: number) => boolean,
    isInfinite: boolean = false,
  ) {
    this.clock = new THREE.Clock();
    this.group = new THREE.Group();
    this.group.renderOrder = Infinity;
    this.group.position.set(x, y, z);
    this.initialX = x;
    this.initialY = y;
    this.initialZ = z;
    this.baseSize = size;
    this.type = type;
    this.animateCallback = animateCallback;
    this.isInfinite = isInfinite;

    this.material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(size, size, size);
    this.group.add(this.sprite);

    if (labelText) {
      this.labelBaseText = labelText;
      const div = document.createElement("div");
      div.className = "fx-label";
      div.textContent = labelText;
      div.style.color = "rgb(223 170 84)";
      div.style.fontFamily = "Cinzel";
      div.style.fontSize = "16px";
      div.style.fontWeight = "bold";
      div.style.textShadow = "0 0 5px black";

      this.label = new CSS2DObject(div);
      this.label.position.set(0, 1.15, 0);
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

    if (this.label && this.label.element && this.labelBaseText) {
      const dotCount = Math.floor((elapsed * 2) % 4);
      this.label.element.textContent = this.labelBaseText + ".".repeat(dotCount);
    }

    // Handle ending animation
    if (this.isEnding) {
      const endElapsed = elapsed - this.endStartTime;
      if (endElapsed < this.endDuration) {
        // Fade out
        const fadeProgress = endElapsed / this.endDuration;
        this.material.opacity = 1 - fadeProgress;

        // Optional: Add some upward movement during fade out
        const moveUp = fadeProgress * 0.5;
        this.group.position.y = this.initialY + moveUp;

        // Skip regular animation when ending to prevent conflicts with travel effect
        this.animationFrameId = requestAnimationFrame(this.animate);
        return;
      } else {
        // End animation complete, destroy the instance
        this.resolvePromise?.();
        this.destroy();
        return;
      }
    }

    const alive = this.animateCallback(this, elapsed);

    if (!alive && !this.isInfinite) {
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

    if (this.label) {
      if (this.label.element) {
        this.label.element.remove();
      }
      if (this.group) {
        this.group.remove(this.label);
      }
    }

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }

    this.material.dispose();
    this.sprite.geometry.dispose();
  }
}

// -------------------- FXManager --------------------
export class FXManager {
  private scene: THREE.Scene;
  private fxConfigs: Map<FXType, FXConfig> = new Map();
  private textures: Map<string, THREE.Texture> = new Map();
  private activeFX: Set<FXInstance> = new Set();
  private defaultSize: number;

  constructor(scene: THREE.Scene, defaultSize: number = 1.5) {
    this.scene = scene;
    this.defaultSize = defaultSize;
    this.registerBuiltInFX();
  }

  private registerBuiltInFX() {
    this.registerFX("skull", {
      textureUrl: "textures/skull.png",
      animate: (fx, t) => {
        const hoverHeight = 1.5;

        if (t < 0.2) {
          const f = t / 0.2;
          fx.material.opacity = f;
          fx.sprite.scale.set(fx.baseSize * f, fx.baseSize * f, fx.baseSize * f);
        } else if (t < 1.5) {
          const hover = Math.sin((t - 0.2) * Math.PI * 2) * 0.1;
          fx.group.position.y = fx.initialY + hover;
          fx.material.opacity = 1;
          fx.sprite.scale.set(fx.baseSize, fx.baseSize, fx.baseSize);
        } else if (t < 2.5) {
          const f = (t - 1.5) / 1.0;
          fx.group.position.y = fx.initialY + hoverHeight * f;
          fx.material.opacity = 1 - f;
        } else {
          return false;
        }

        return true;
      },
    });

    this.registerFX("compass", {
      textureUrl: "textures/compass.png",
      animate: (fx, t) => {
        // Fade in animation
        if (t < 0.3) {
          fx.material.opacity = t / 0.3;
        } else {
          fx.material.opacity = 1;
        }

        // Ensure the sprite is facing the camera
        fx.sprite.material.rotation = t * 2;

        return true; // Always return true to keep it running
      },
    });

    this.registerFX("travel", {
      textureUrl: "textures/travel.png",
      animate: (fx, t) => {
        // Fade in animation
        if (t < 0.3) {
          fx.material.opacity = t / 0.3;
        } else {
          fx.material.opacity = 1;
        }

        const cycle = t % 3.0;

        const bob = Math.sin(cycle * Math.PI * 2) * 0.05;
        const sway = Math.sin(cycle * Math.PI) * 0.05;
        fx.group.position.y = fx.initialY + bob;
        fx.group.position.x += sway * 0.01;
        fx.sprite.scale.set(fx.baseSize, fx.baseSize, fx.baseSize);

        return true;
      },
      isInfinite: true,
    });
  }

  public registerRelicFX(relicNumber: number) {
    const type = `relic_${relicNumber}`;
    this.registerFX(type, {
      textureUrl: `images/resources/${relicNumber}.png`,
      animate: (fx, t) => {
        // Fade in animation
        if (t < 0.5) {
          fx.material.opacity = t / 0.5;
          const scale = (t / 0.5) * fx.baseSize;
          fx.sprite.scale.set(scale, scale, scale);
        } else {
          fx.material.opacity = 1;
          fx.sprite.scale.set(fx.baseSize, fx.baseSize, fx.baseSize);
        }

        // Get unique orbit parameters based on fx instance
        const orbitSpeed = 0.5 + (fx.sprite.id % 3) * 0.2; // Different speeds
        const orbitRadius = 0.5 + (fx.sprite.id % 2) * 0.3; // Different radii
        const verticalOffset = (fx.sprite.id % 4) * 0.2; // Different heights
        const phase = (fx.sprite.id % 6) * (Math.PI / 3); // Different starting positions

        // Orbital motion
        const angle = t * orbitSpeed + phase;
        fx.group.position.x = fx.initialX + Math.cos(angle) * orbitRadius;
        fx.group.position.z = fx.initialZ + Math.sin(angle) * orbitRadius;

        // Vertical bobbing
        const bob = Math.sin(t * 2 + phase) * 0.1;
        fx.group.position.y = fx.initialY + verticalOffset + bob;

        return true;
      },
      isInfinite: true,
    });
  }

  private registerFX(type: FXType, config: FXConfig) {
    if (!this.textures.has(config.textureUrl)) {
      const texture = new THREE.TextureLoader().load(config.textureUrl, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
      });
      this.textures.set(config.textureUrl, texture);
    }
    this.fxConfigs.set(type, config);
  }

  playFxAtCoords(
    type: FXType,
    x: number,
    y: number,
    z: number,
    size?: number,
    labelText?: string,
    isInfinite: boolean = false,
  ): { promise: Promise<void>; end: () => void } {
    const config = this.fxConfigs.get(type);
    if (!config) {
      console.warn(`FX type '${type}' is not registered.`);
      return {
        promise: Promise.reject(`FX type '${type}' not registered.`),
        end: () => {},
      };
    }

    const texture = this.textures.get(config.textureUrl);
    if (!texture || !texture.image) {
      console.warn("Texture not loaded yet, skipping FX");
      return {
        promise: Promise.reject("Texture not loaded"),
        end: () => {},
      };
    }

    let fxInstance: FXInstance | null = null;
    const promise = new Promise<void>((resolve) => {
      fxInstance = new FXInstance(
        this.scene,
        texture,
        type,
        x,
        y,
        z,
        size ?? this.defaultSize,
        labelText,
        config.animate,
        isInfinite || config.isInfinite,
      );

      fxInstance.onComplete(resolve);
      this.activeFX.add(fxInstance);

      const cleanup = () => {
        this.activeFX.delete(fxInstance!);
      };

      const originalDestroy = fxInstance.destroy;
      fxInstance.destroy = () => {
        originalDestroy.call(fxInstance);
        cleanup();
      };
    });

    return {
      promise,
      end: () => {
        if (fxInstance && !fxInstance.isDestroyed) {
          fxInstance.startEnding();
        }
      },
    };
  }

  destroy() {
    this.activeFX.forEach((fx) => fx.destroy());
    this.activeFX.clear();
    this.textures.forEach((texture) => texture.dispose());
    this.textures.clear();
  }
}
