import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { RendererFxCapabilities } from "../renderer-fx-capabilities";

const DOT_SUFFIXES = ["", ".", "..", "..."];
const WORLD_FX_RENDER_ORDER = 10_000;

export type WorldFxBackendKind = "legacy-sprite" | "webgpu-billboard";

export interface IconFxAnimationRuntime {
  readonly baseSize: number;
  readonly initialX: number;
  readonly initialY: number;
  readonly initialZ: number;
  offsetPosition(dx: number, dy: number, dz: number): void;
  setOpacity(opacity: number): void;
  setPosition(x: number, y: number, z: number): void;
  setRotation(rotation: number): void;
  setScale(x: number, y: number, z: number): void;
}

export interface IconFxSpec {
  animate: (fx: IconFxAnimationRuntime, elapsed: number) => boolean;
  isInfinite?: boolean;
  labelText?: string;
  size: number;
  texture: THREE.Texture;
  type: string;
  x: number;
  y: number;
  z: number;
}

export interface TextFxSpec {
  color: string;
  duration?: number;
  fadeOutDuration?: number;
  floatHeight?: number;
  floatRight?: number;
  fontSize?: string;
  text: string;
  x: number;
  y: number;
  z: number;
}

export interface WorldFxHandle {
  dispose(): void;
  end(): void;
  promise: Promise<void>;
}

export interface WorldFxBackend {
  readonly kind: WorldFxBackendKind;
  destroy(): void;
  spawnIconFx(spec: IconFxSpec): WorldFxHandle;
  spawnTextFx(spec: TextFxSpec): WorldFxHandle;
  update(deltaTime: number): void;
}

export interface CreateWorldFxBackendOptions {
  capabilities: RendererFxCapabilities;
  scene: THREE.Scene;
}

interface ManagedWorldFxEffect {
  isDestroyed: boolean;
  onComplete(resolve: () => void): void;
  startEnding(): void;
  destroy(): void;
  update(deltaTime: number): boolean;
}

abstract class BaseIconWorldFxEffect implements ManagedWorldFxEffect, IconFxAnimationRuntime {
  public readonly group: THREE.Group;
  public readonly initialX: number;
  public readonly initialY: number;
  public readonly initialZ: number;
  public readonly baseSize: number;
  public isDestroyed = false;

  protected readonly animateCallback: IconFxSpec["animate"];
  protected readonly isInfinite: boolean;
  protected readonly label?: CSS2DObject;
  protected readonly labelBaseText?: string;
  protected age = 0;
  protected resolvePromise?: () => void;
  private endStartTime = 0;
  private readonly endDuration = 0.5;
  private isEnding = false;
  private lastDotCount = -1;

  constructor(protected readonly scene: THREE.Scene, protected readonly spec: IconFxSpec) {
    this.group = new THREE.Group();
    this.group.renderOrder = WORLD_FX_RENDER_ORDER;
    this.group.position.set(spec.x, spec.y, spec.z);
    this.initialX = spec.x;
    this.initialY = spec.y;
    this.initialZ = spec.z;
    this.baseSize = spec.size;
    this.animateCallback = spec.animate;
    this.isInfinite = spec.isInfinite ?? false;

    if (spec.labelText) {
      this.labelBaseText = spec.labelText;
      const div = document.createElement("div");
      div.className = "fx-label";
      div.textContent = spec.labelText;
      div.style.color = "rgb(223 170 84)";
      div.style.fontFamily = "Cinzel";
      div.style.fontSize = "16px";
      div.style.fontWeight = "bold";
      div.style.textShadow = "0 0 5px black";

      this.label = new CSS2DObject(div);
      this.label.position.set(0, 1.15, 0);
      this.group.add(this.label);
    }

    this.scene.add(this.group);
  }

  public onComplete(resolve: () => void): void {
    this.resolvePromise = resolve;
  }

  public startEnding(): void {
    if (!this.isEnding) {
      this.isEnding = true;
      this.endStartTime = this.age;
    }
  }

  public update(deltaTime: number): boolean {
    if (this.isDestroyed) {
      return false;
    }

    this.age += deltaTime;
    const elapsed = this.age;

    if (this.label?.element && this.labelBaseText) {
      const dotCount = Math.floor((elapsed * 2) % DOT_SUFFIXES.length);
      if (dotCount !== this.lastDotCount) {
        this.lastDotCount = dotCount;
        this.label.element.textContent = this.labelBaseText + DOT_SUFFIXES[dotCount];
      }
    }

    if (this.isEnding) {
      const endElapsed = elapsed - this.endStartTime;
      if (endElapsed < this.endDuration) {
        const fadeProgress = endElapsed / this.endDuration;
        this.setOpacity(1 - fadeProgress);
        this.setPosition(this.initialX, this.initialY + fadeProgress * 0.5, this.initialZ);
        return true;
      }

      this.resolvePromise?.();
      this.destroy();
      return false;
    }

    const alive = this.animateCallback(this, elapsed);
    if (!alive && !this.isInfinite) {
      this.resolvePromise?.();
      this.destroy();
      return false;
    }

    return true;
  }

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    if (this.label?.element) {
      this.label.element.remove();
    }

    if (this.label) {
      this.group.remove(this.label);
    }

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }

    this.disposeVisuals();
  }

  public offsetPosition(dx: number, dy: number, dz: number): void {
    this.group.position.x += dx;
    this.group.position.y += dy;
    this.group.position.z += dz;
  }

  public setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  public abstract setOpacity(opacity: number): void;
  public abstract setRotation(rotation: number): void;
  public abstract setScale(x: number, y: number, z: number): void;
  protected abstract disposeVisuals(): void;
}

class LegacySpriteWorldFxEffect extends BaseIconWorldFxEffect {
  private readonly material: THREE.SpriteMaterial;
  private readonly sprite: THREE.Sprite;

  constructor(scene: THREE.Scene, spec: IconFxSpec) {
    super(scene, spec);

    this.material = new THREE.SpriteMaterial({
      depthWrite: false,
      map: spec.texture,
      opacity: 0,
      transparent: true,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(spec.size, spec.size, spec.size);
    this.group.add(this.sprite);
  }

  public setOpacity(opacity: number): void {
    this.material.opacity = opacity;
  }

  public setRotation(rotation: number): void {
    this.material.rotation = rotation;
  }

  public setScale(x: number, y: number, z: number): void {
    this.sprite.scale.set(x, y, z);
  }

  protected disposeVisuals(): void {
    this.material.dispose();
    this.sprite.geometry.dispose();
  }
}

class WebGpuBillboardWorldFxEffect extends BaseIconWorldFxEffect {
  private readonly material: THREE.MeshBasicMaterial;
  private readonly pivot: THREE.Group;
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  constructor(scene: THREE.Scene, spec: IconFxSpec) {
    super(scene, spec);

    this.material = new THREE.MeshBasicMaterial({
      depthWrite: false,
      map: spec.texture,
      opacity: 0,
      transparent: true,
    });

    this.pivot = new THREE.Group();
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.scale.set(spec.size, spec.size, spec.size);
    this.pivot.onBeforeRender = (_renderer, _scene, camera) => {
      this.pivot.quaternion.copy(camera.quaternion);
    };
    this.pivot.add(this.mesh);
    this.group.add(this.pivot);
  }

  public setOpacity(opacity: number): void {
    this.material.opacity = opacity;
  }

  public setRotation(rotation: number): void {
    this.mesh.rotation.z = rotation;
  }

  public setScale(x: number, y: number, z: number): void {
    this.mesh.scale.set(x, y, z);
  }

  protected disposeVisuals(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.pivot.clear();
  }
}

class TextWorldFxEffect implements ManagedWorldFxEffect {
  public readonly group: THREE.Group;
  public readonly label: CSS2DObject;
  public isDestroyed = false;
  private age = 0;
  private readonly initialX: number;
  private readonly initialY: number;
  private readonly floatHeight: number;
  private readonly floatRight: number;
  private readonly duration: number;
  private readonly fadeOutDuration: number;
  private resolvePromise?: () => void;
  private isEnding = false;
  private endStartTime = 0;

  constructor(scene: THREE.Scene, spec: TextFxSpec) {
    this.group = new THREE.Group();
    this.group.renderOrder = WORLD_FX_RENDER_ORDER;
    this.group.position.set(spec.x, spec.y, spec.z);
    this.initialX = spec.x;
    this.initialY = spec.y;
    this.floatHeight = spec.floatHeight ?? 2.0;
    this.floatRight = spec.floatRight ?? this.floatHeight * 0.6;
    this.duration = spec.duration ?? 1.5;
    this.fadeOutDuration = spec.fadeOutDuration ?? 0.5;

    const div = document.createElement("div");
    div.className = "troop-diff-fx";
    div.textContent = spec.text;
    div.style.color = spec.color;
    div.style.fontFamily = "Cinzel";
    div.style.fontSize = spec.fontSize ?? "36px";
    div.style.fontWeight = "bold";
    div.style.textShadow = "0 0 12px black, 0 0 6px black, 2px 2px 4px black";
    div.style.opacity = "0";
    div.style.transition = "none";

    this.label = new CSS2DObject(div);
    this.group.add(this.label);
    scene.add(this.group);
  }

  public onComplete(resolve: () => void): void {
    this.resolvePromise = resolve;
  }

  public startEnding(): void {
    if (!this.isEnding) {
      this.isEnding = true;
      this.endStartTime = this.age;
    }
  }

  public update(deltaTime: number): boolean {
    if (this.isDestroyed) {
      return false;
    }

    this.age += deltaTime;

    if (!this.isEnding && this.age > this.duration) {
      this.startEnding();
    }

    if (this.isEnding) {
      const endElapsed = this.age - this.endStartTime;
      if (endElapsed < this.fadeOutDuration) {
        const fadeProgress = endElapsed / this.fadeOutDuration;
        this.label.element.style.opacity = `${1 - fadeProgress}`;
        const extraMove = fadeProgress * 0.5;
        this.group.position.x = this.initialX + this.floatRight + extraMove * 0.6;
        this.group.position.y = this.initialY + this.floatHeight + extraMove;
        return true;
      }

      this.resolvePromise?.();
      this.destroy();
      return false;
    }

    if (this.age < 0.15) {
      this.label.element.style.opacity = `${this.age / 0.15}`;
    } else {
      this.label.element.style.opacity = "1";
    }

    const progress = Math.min(this.age / this.duration, 1);
    this.group.position.x = this.initialX + this.floatRight * progress;
    this.group.position.y = this.initialY + this.floatHeight * progress;

    return true;
  }

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    this.label.element.remove();
    this.group.remove(this.label);

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}

abstract class BaseWorldFxBackend implements WorldFxBackend {
  public abstract readonly kind: WorldFxBackendKind;
  protected readonly activeEffects = new Set<ManagedWorldFxEffect>();

  constructor(protected readonly scene: THREE.Scene, protected readonly capabilities: RendererFxCapabilities) {}

  public update(deltaTime: number): void {
    if (this.activeEffects.size === 0) {
      return;
    }

    this.activeEffects.forEach((effect) => {
      effect.update(deltaTime);
    });
  }

  public destroy(): void {
    this.activeEffects.forEach((effect) => {
      effect.destroy();
    });
    this.activeEffects.clear();
  }

  public spawnTextFx(spec: TextFxSpec): WorldFxHandle {
    if (!this.capabilities.supportsDomLabelFx) {
      return createNoopWorldFxHandle();
    }

    return this.registerEffect(new TextWorldFxEffect(this.scene, spec));
  }

  public abstract spawnIconFx(spec: IconFxSpec): WorldFxHandle;

  protected registerEffect(effect: ManagedWorldFxEffect): WorldFxHandle {
    this.activeEffects.add(effect);

    const promise = new Promise<void>((resolve) => {
      effect.onComplete(resolve);
    });

    const cleanup = () => {
      this.activeEffects.delete(effect);
    };

    const originalDestroy = effect.destroy.bind(effect);
    effect.destroy = () => {
      originalDestroy();
      cleanup();
    };

    return {
      dispose: () => {
        effect.destroy();
      },
      end: () => {
        effect.startEnding();
      },
      promise,
    };
  }
}

class LegacySpriteWorldFxBackend extends BaseWorldFxBackend {
  public readonly kind = "legacy-sprite" as const;

  public spawnIconFx(spec: IconFxSpec): WorldFxHandle {
    return this.registerEffect(new LegacySpriteWorldFxEffect(this.scene, spec));
  }
}

class WebGpuBillboardWorldFxBackend extends BaseWorldFxBackend {
  public readonly kind = "webgpu-billboard" as const;

  public spawnIconFx(spec: IconFxSpec): WorldFxHandle {
    return this.registerEffect(new WebGpuBillboardWorldFxEffect(this.scene, spec));
  }
}

export function createWorldFxBackend(options: CreateWorldFxBackendOptions): WorldFxBackend {
  if (options.capabilities.supportsSpriteSceneFx) {
    return new LegacySpriteWorldFxBackend(options.scene, options.capabilities);
  }

  return new WebGpuBillboardWorldFxBackend(options.scene, options.capabilities);
}

function createNoopWorldFxHandle(): WorldFxHandle {
  return {
    dispose: () => {},
    end: () => {},
    promise: Promise.resolve(),
  };
}
