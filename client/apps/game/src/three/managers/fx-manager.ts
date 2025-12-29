import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

const DOT_SUFFIXES = ["", ".", "..", "..."];

type FXType = "skull" | "compass" | "troopDiff" | string;

interface FXConfig {
  textureUrl: string;
  animate: (fx: FXInstance, elapsed: number) => boolean; // return false to stop
  isInfinite?: boolean; // if true, effect will continue until manually stopped
}

// -------------------- BatchedFXSystem --------------------
class BatchedFXSystem {
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Points;
  private maxParticles: number;
  private particleCount: number = 0;
  private texture: THREE.Texture;
  private positions: Float32Array;
  private scales: Float32Array;
  private opacities: Float32Array;
  private startTimes: Float32Array;
  private lifetimes: Float32Array;
  private activeIndices: number[] = [];
  private freeIndices: number[] = [];

  constructor(scene: THREE.Scene, texture: THREE.Texture, maxParticles: number = 1000) {
    this.maxParticles = maxParticles;
    this.texture = texture;

    // Initialize attributes
    this.positions = new Float32Array(maxParticles * 3);
    this.scales = new Float32Array(maxParticles);
    this.opacities = new Float32Array(maxParticles);
    this.startTimes = new Float32Array(maxParticles);
    this.lifetimes = new Float32Array(maxParticles);

    // Initialize free indices
    for (let i = 0; i < maxParticles; i++) {
      this.freeIndices.push(i);
      this.scales[i] = 0; // Hide initially
    }

    // Create geometry
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("scale", new THREE.BufferAttribute(this.scales, 1));
    this.geometry.setAttribute("opacity", new THREE.BufferAttribute(this.opacities, 1));

    // Custom shader for batched particles
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
      },
      vertexShader: `
        attribute float scale;
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = scale * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        varying float vOpacity;
        void main() {
          vec4 texColor = texture2D(map, gl_PointCoord);
          gl_FragColor = texColor * vec4(1.0, 1.0, 1.0, vOpacity);
          if (gl_FragColor.a < 0.01) discard;
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false; // Always render if in scene
    scene.add(this.mesh);
  }

  spawn(x: number, y: number, z: number, scale: number, lifetime: number): number {
    if (this.freeIndices.length === 0) return -1;

    const index = this.freeIndices.pop()!;
    this.activeIndices.push(index);

    this.positions[index * 3] = x;
    this.positions[index * 3 + 1] = y;
    this.positions[index * 3 + 2] = z;
    this.scales[index] = scale;
    this.opacities[index] = 1.0;
    this.startTimes[index] = performance.now() / 1000;
    this.lifetimes[index] = lifetime;

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.scale.needsUpdate = true;
    this.geometry.attributes.opacity.needsUpdate = true;

    return index;
  }

  update(time: number, animateCallback: (index: number, elapsed: number) => void) {
    if (this.activeIndices.length === 0) return;

    let needsUpdate = false;
    const indicesToRemove: number[] = [];

    for (let i = 0; i < this.activeIndices.length; i++) {
      const index = this.activeIndices[i];
      const elapsed = time - this.startTimes[index];

      if (elapsed > this.lifetimes[index]) {
        indicesToRemove.push(i);
        continue;
      }

      // Run custom animation logic
      animateCallback(index, elapsed);
      needsUpdate = true;
    }

    // Remove dead particles
    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      const removeIndex = indicesToRemove[i];
      const particleIndex = this.activeIndices[removeIndex];

      this.scales[particleIndex] = 0; // Hide
      this.freeIndices.push(particleIndex);
      this.activeIndices.splice(removeIndex, 1);
      needsUpdate = true;
    }

    if (needsUpdate) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.scale.needsUpdate = true;
      this.geometry.attributes.opacity.needsUpdate = true;
    }
  }

  setPosition(index: number, x: number, y: number, z: number) {
    this.positions[index * 3] = x;
    this.positions[index * 3 + 1] = y;
    this.positions[index * 3 + 2] = z;
    this.geometry.attributes.position.needsUpdate = true;
  }

  setScale(index: number, scale: number) {
    this.scales[index] = scale;
    this.geometry.attributes.scale.needsUpdate = true;
  }

  setOpacity(index: number, opacity: number) {
    this.opacities[index] = opacity;
    this.geometry.attributes.opacity.needsUpdate = true;
  }

  destroy() {
    this.geometry.dispose();
    this.material.dispose();
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}

// -------------------- FXInstance --------------------
class FXInstance {
  public group: THREE.Group;
  public sprite: THREE.Sprite;
  public material: THREE.SpriteMaterial;
  public age: number = 0;
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
  private lastDotCount: number = -1;

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
  }

  public onComplete(resolve: () => void) {
    this.resolvePromise = resolve;
  }

  public startEnding() {
    if (!this.isEnding) {
      this.isEnding = true;
      this.endStartTime = this.age;
    }
  }

  public update(deltaTime: number): boolean {
    if (this.isDestroyed) return false;

    this.age += deltaTime;
    const elapsed = this.age;

    if (this.label && this.label.element && this.labelBaseText) {
      const dotCount = Math.floor((elapsed * 2) % DOT_SUFFIXES.length);
      if (dotCount !== this.lastDotCount) {
        this.lastDotCount = dotCount;
        this.label.element.textContent = this.labelBaseText + DOT_SUFFIXES[dotCount];
      }
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

        return true;
      } else {
        // End animation complete, destroy the instance
        this.resolvePromise?.();
        this.destroy();
        return false;
      }
    }

    const alive = this.animateCallback(this, elapsed);

    if (!alive && !this.isInfinite) {
      this.resolvePromise?.();
      this.destroy();
      return false;
    }

    return true;
  }

  public destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

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

// -------------------- TroopDiffFXInstance --------------------
class TroopDiffFXInstance {
  public group: THREE.Group;
  public label: CSS2DObject;
  public isDestroyed = false;
  public initialX: number;
  public initialY: number;
  public resolvePromise?: () => void;
  public age: number = 0;
  private floatHeight: number;
  private floatRight: number;
  private duration: number;
  private fadeOutDuration: number;
  private isEnding: boolean = false;
  private endStartTime: number = 0;

  constructor(
    scene: THREE.Scene,
    diff: number,
    x: number,
    y: number,
    z: number,
    floatHeight: number = 2.0,
    duration: number = 1.5,
    fadeOutDuration: number = 0.5,
  ) {
    this.group = new THREE.Group();
    this.group.renderOrder = Infinity;
    this.group.position.set(x, y, z);
    this.initialX = x;
    this.initialY = y;
    this.floatHeight = floatHeight;
    this.floatRight = floatHeight * 0.6; // Move right proportionally to height
    this.duration = duration;
    this.fadeOutDuration = fadeOutDuration;

    // Create floating damage/heal text
    const div = document.createElement("div");
    div.className = "troop-diff-fx";
    const isHeal = diff > 0;
    div.textContent = isHeal ? `+${diff}` : `${diff}`;
    div.style.color = isHeal ? "rgb(94, 232, 94)" : "rgb(255, 80, 80)";
    div.style.fontFamily = "Cinzel";
    div.style.fontSize = "36px";
    div.style.fontWeight = "bold";
    div.style.textShadow = "0 0 12px black, 0 0 6px black, 2px 2px 4px black";
    div.style.opacity = "0";
    div.style.transition = "none";

    this.label = new CSS2DObject(div);
    this.label.position.set(0, 0, 0);
    this.group.add(this.label);

    scene.add(this.group);
  }

  public onComplete(resolve: () => void) {
    this.resolvePromise = resolve;
  }

  public startEnding() {
    if (!this.isEnding) {
      this.isEnding = true;
      this.endStartTime = this.age;
    }
  }

  public update(deltaTime: number): boolean {
    if (this.isDestroyed) return false;

    this.age += deltaTime;
    const elapsed = this.age;

    if (!this.isEnding && elapsed > this.duration) {
      this.startEnding();
    }

    // Handle ending animation
    if (this.isEnding) {
      const endElapsed = elapsed - this.endStartTime;
      if (endElapsed < this.fadeOutDuration) {
        const fadeProgress = endElapsed / this.fadeOutDuration;
        this.label.element.style.opacity = `${1 - fadeProgress}`;
        // Continue moving top-right during fade
        const extraMove = fadeProgress * 0.5;
        this.group.position.x = this.initialX + this.floatRight + extraMove * 0.6;
        this.group.position.y = this.initialY + this.floatHeight + extraMove;
        return true;
      }

      this.resolvePromise?.();
      this.destroy();
      return false;
    }

    // Fade in (first 0.15 seconds)
    if (elapsed < 0.15) {
      this.label.element.style.opacity = `${elapsed / 0.15}`;
    } else {
      this.label.element.style.opacity = "1";
    }

    // Float to top-right
    const progress = Math.min(elapsed / this.duration, 1);
    this.group.position.x = this.initialX + this.floatRight * progress;
    this.group.position.y = this.initialY + this.floatHeight * progress;

    return true;
  }

  public destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.label && this.label.element) {
      this.label.element.remove();
      this.group.remove(this.label);
    }

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}

// -------------------- FXManager --------------------
export class FXManager {
  private scene: THREE.Scene;
  private fxConfigs: Map<FXType, FXConfig> = new Map();
  private textures: Map<string, THREE.Texture> = new Map();
  private activeFX: Set<FXInstance> = new Set();
  private activeTroopDiffFX: Set<TroopDiffFXInstance> = new Set();
  private defaultSize: number;

  // Batched system support
  private batchedSystems: Map<string, BatchedFXSystem> = new Map();
  private useBatching: boolean = true;

  constructor(scene: THREE.Scene, defaultSize: number = 1.5) {
    this.scene = scene;
    this.defaultSize = defaultSize;
    this.registerBuiltInFX();
  }

  public update(deltaTime: number) {
    // Update legacy FX
    this.activeFX.forEach((fx) => {
      fx.update(deltaTime);
    });

    this.activeTroopDiffFX.forEach((fx) => {
      fx.update(deltaTime);
    });

    // Update batched systems
    // Note: We don't currently have a unified update loop for batched systems
    // because the animation logic is still tied to the legacy FXInstance interface
    // for now. Phase 2 would fully migrate animation logic to the BatchedFXSystem.
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

  public async registerRelicFX(relicNumber: number): Promise<void> {
    const type = `relic_${relicNumber}`;
    const textureUrl = `images/resources/${relicNumber}.png`;

    // Pre-load the texture and wait for it to load
    if (!this.textures.has(textureUrl)) {
      const texture = await new Promise<THREE.Texture>((resolve, _reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(
          textureUrl,
          (loadedTexture) => {
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            loadedTexture.minFilter = THREE.LinearFilter;
            loadedTexture.magFilter = THREE.LinearFilter;
            resolve(loadedTexture);
          },
          undefined,
          (error) => {
            console.warn(`Failed to load relic texture ${textureUrl}:`, error);
            // Create a fallback white texture
            const canvas = document.createElement("canvas");
            canvas.width = 64;
            canvas.height = 64;
            const context = canvas.getContext("2d")!;
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, 64, 64);
            const fallbackTexture = new THREE.CanvasTexture(canvas);
            fallbackTexture.colorSpace = THREE.SRGBColorSpace;
            resolve(fallbackTexture);
          },
        );
      });
      this.textures.set(textureUrl, texture);
    }

    this.registerFX(type, {
      textureUrl,
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
  ): { promise: Promise<void>; end: () => void; instance?: FXInstance } {
    const config = this.fxConfigs.get(type);
    if (!config) {
      console.warn(`FX type '${type}' is not registered.`);
      return {
        promise: Promise.reject(`FX type '${type}' not registered.`),
        end: () => {},
        instance: undefined,
      };
    }

    const texture = this.textures.get(config.textureUrl);
    if (!texture || !texture.image) {
      console.warn("Texture not loaded yet, skipping FX");
      return {
        promise: Promise.reject("Texture not loaded"),
        end: () => {},
        instance: undefined,
      };
    }

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
      isInfinite || config.isInfinite,
    );

    // Set initial position for orbital effects
    fxInstance.initialX = x;
    fxInstance.initialZ = z;

    const promise = new Promise<void>((resolve) => {
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

    return {
      promise,
      end: () => {
        if (fxInstance && !fxInstance.isDestroyed) {
          fxInstance.startEnding();
        }
      },
      instance: fxInstance,
    };
  }

  /**
   * Play a floating troop count diff effect (damage in red, heal in green)
   * @param diff The troop count difference (negative = damage, positive = heal)
   * @param x X coordinate
   * @param y Y coordinate
   * @param z Z coordinate
   * @returns Promise that resolves when animation completes
   */
  playTroopDiffFx(diff: number, x: number, y: number, z: number): Promise<void> {
    if (diff === 0) {
      return Promise.resolve();
    }

    let fxInstance: TroopDiffFXInstance | null = null;
    const promise = new Promise<void>((resolve) => {
      fxInstance = new TroopDiffFXInstance(this.scene, diff, x, y, z);

      fxInstance.onComplete(resolve);
      this.activeTroopDiffFX.add(fxInstance);

      const cleanup = () => {
        this.activeTroopDiffFX.delete(fxInstance!);
      };

      const originalDestroy = fxInstance.destroy;
      fxInstance.destroy = () => {
        originalDestroy.call(fxInstance);
        cleanup();
      };
    });

    return promise;
  }

  destroy() {
    this.activeFX.forEach((fx) => fx.destroy());
    this.activeFX.clear();
    this.activeTroopDiffFX.forEach((fx) => fx.destroy());
    this.activeTroopDiffFX.clear();
    this.textures.forEach((texture) => texture.dispose());
    this.textures.clear();
  }
}
