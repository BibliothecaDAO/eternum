import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

type FXType = "skull" | "compass" | string;

interface FXConfig {
  textureUrl: string;
  animate: (fx: FXInstance, elapsed: number) => boolean; // return false to stop
}

// -------------------- FXInstance --------------------
class FXInstance {
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
  public labelBaseText?: string;
  public type: FXType;
  public animateCallback: (fx: FXInstance, elapsed: number) => boolean;

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
  ) {
    this.clock = new THREE.Clock();
    this.group = new THREE.Group();
    this.group.renderOrder = Infinity;
    this.group.position.set(x, y, z);
    this.initialY = y;
    this.baseSize = size;
    this.type = type;
    this.animateCallback = animateCallback;

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
      this.label.position.set(0, 1, 0);
      this.group.add(this.label);
    }

    scene.add(this.group);
    this.animate();
  }

  public onComplete(resolve: () => void) {
    this.resolvePromise = resolve;
  }

  private animate = () => {
    if (this.isDestroyed) return;

    const elapsed = this.clock.getElapsedTime();

    if (this.label && this.label.element && this.labelBaseText) {
      const dotCount = Math.floor((elapsed * 2) % 4);
      this.label.element.textContent = this.labelBaseText + ".".repeat(dotCount);
    }

    const alive = this.animateCallback(this, elapsed);

    if (!alive) {
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
        const duration = 3.0;

        if (t < 0.3) {
          fx.material.opacity = t / 0.3;
        } else if (t < duration) {
          fx.material.opacity = 1;
        } else if (t < duration + 0.5) {
          fx.material.opacity = 1 - (t - duration) / 0.5;
        } else {
          return false;
        }

        fx.group.rotation.z = t * 2;
        return true;
      },
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

  playFxAtCoords(type: FXType, x: number, y: number, z: number, size?: number, labelText?: string): Promise<void> {
    const config = this.fxConfigs.get(type);
    if (!config) {
      console.warn(`FX type '${type}' is not registered.`);
      return Promise.reject(`FX type '${type}' not registered.`);
    }

    const texture = this.textures.get(config.textureUrl);
    if (!texture || !texture.image) {
      console.warn("Texture not loaded yet, skipping FX");
      return Promise.reject("Texture not loaded");
    }

    return new Promise((resolve) => {
      const fxInstance = new FXInstance(
        this.scene,
        texture,
        type,
        x,
        y,
        z,
        size ?? this.defaultSize,
        labelText,
        config.animate,
      );

      fxInstance.onComplete(resolve);
      this.activeFX.add(fxInstance);

      const cleanup = () => {
        this.activeFX.delete(fxInstance);
      };

      const originalDestroy = fxInstance.destroy;
      fxInstance.destroy = () => {
        originalDestroy.call(fxInstance);
        cleanup();
      };
    });
  }

  destroy() {
    this.activeFX.forEach((fx) => fx.destroy());
    this.activeFX.clear();
    this.textures.forEach((texture) => texture.dispose());
    this.textures.clear();
  }
}
