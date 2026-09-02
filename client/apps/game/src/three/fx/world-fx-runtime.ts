import { Camera, Group, Scene, Vector3 } from "three";

import { WorldFxParticlePool, WorldFxRingPool, hashNumber } from "./world-fx-pools";

type WorldFxTone = "arcane" | "fire" | "healing" | "physical";

interface WorldFxImpactCue {
  kind: "impact";
  normal?: Readonly<Vector3>;
  position: Readonly<Vector3>;
  scale?: number;
  seed: number;
  tone?: WorldFxTone;
}

interface WorldFxExplosionCue {
  kind: "explosion";
  normal?: Readonly<Vector3>;
  position: Readonly<Vector3>;
  scale?: number;
  seed: number;
  tone?: WorldFxTone;
}

interface WorldFxShockwaveCue {
  kind: "shockwave";
  normal?: Readonly<Vector3>;
  position: Readonly<Vector3>;
  scale?: number;
  seed: number;
  tone?: WorldFxTone;
}

interface BaseWorldFxPathCue {
  from: Readonly<Vector3>;
  scale?: number;
  seed: number;
  to: Readonly<Vector3>;
  tone?: WorldFxTone;
}

interface WorldFxBeamCue extends BaseWorldFxPathCue {
  kind: "beam";
}

interface WorldFxDragonBreathCue extends BaseWorldFxPathCue {
  kind: "dragon-breath";
}

interface WorldFxProjectileTrailCue extends BaseWorldFxPathCue {
  kind: "projectile-trail";
}

export type TransientWorldFxCue =
  | WorldFxBeamCue
  | WorldFxDragonBreathCue
  | WorldFxExplosionCue
  | WorldFxImpactCue
  | WorldFxProjectileTrailCue
  | WorldFxShockwaveCue;

interface WorldFxFlameEmitter {
  id: string;
  intensity?: number;
  kind: "flame";
  position: Readonly<Vector3>;
  scale?: number;
  seed: number;
}

interface WorldFxAuraEmitter {
  id: string;
  intensity?: number;
  kind: "aura";
  position: Readonly<Vector3>;
  scale?: number;
  seed: number;
  style: "capture" | "healing" | "shield";
}

export type PersistentWorldFxEmitter = WorldFxAuraEmitter | WorldFxFlameEmitter;

export interface WorldFxHandle {
  dispose(): void;
  end(): void;
  promise: Promise<void>;
}

export interface WorldFxStats {
  activeAdditiveParticles: number;
  activeAuraEmitters: number;
  activeEmitters: number;
  activeFlameEmitters: number;
  activeRings: number;
  activeSmokeParticles: number;
  activeTransientEffects: number;
  additiveCapacity: number;
  drawCalls: number;
  droppedCount: number;
  fingerprint: string;
  ringCapacity: number;
  smokeCapacity: number;
  triangles: number;
}

export interface WorldFxRuntime {
  dispose(): void;
  emit(cue: TransientWorldFxCue): WorldFxHandle;
  getStats(): WorldFxStats;
  sync(emitters: readonly PersistentWorldFxEmitter[]): void;
  update(deltaSeconds: number): void;
}

export interface CreateWorldFxRuntimeOptions {
  camera: Camera;
  scene: Scene;
}

interface FlameEmitterState {
  emissionIndex: number;
  elapsedSeconds: number;
  id: string;
  intensity: number;
  lastSeenGeneration: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  scale: number;
  seed: number;
}

interface AuraEmitterState {
  emissionIndex: number;
  elapsedSeconds: number;
  id: string;
  intensity: number;
  lastSeenGeneration: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  scale: number;
  seed: number;
  style: WorldFxAuraEmitter["style"];
}

interface TransientEffectState {
  id: number;
  promise: Promise<void>;
  resolve: () => void;
  settled: boolean;
}

const ADDITIVE_CAPACITY = 2_048;
const SMOKE_CAPACITY = 1_024;
const RING_CAPACITY = 256;
const MAX_DELTA_SECONDS = 0.05;
const FLAME_INTERVAL_SECONDS = 0.055;
const AURA_INTERVAL_SECONDS = 0.14;
const WORLD_UP = new Vector3(0, 1, 0);

class DefaultWorldFxRuntime implements WorldFxRuntime {
  private readonly root = new Group();
  private readonly additive = new WorldFxParticlePool("additive", ADDITIVE_CAPACITY);
  private readonly smoke = new WorldFxParticlePool("smoke", SMOKE_CAPACITY);
  private readonly rings = new WorldFxRingPool(RING_CAPACITY);
  private readonly flameEmitters = new Map<string, FlameEmitterState>();
  private readonly auraEmitters = new Map<string, AuraEmitterState>();
  private readonly effects = new Map<number, TransientEffectState>();
  private readonly normal = new Vector3();
  private readonly tangent = new Vector3();
  private readonly bitangent = new Vector3();
  private readonly scratchPosition = new Vector3();
  private syncGeneration = 0;
  private nextEffectId = 1;
  private disposed = false;

  constructor(private readonly options: CreateWorldFxRuntimeOptions) {
    this.root.name = "world-fx-runtime";
    this.root.add(this.additive.mesh, this.smoke.mesh, this.rings.mesh);
    this.options.scene.add(this.root);
  }

  public emit(cue: TransientWorldFxCue): WorldFxHandle {
    this.requireAlive();
    validateTransientCue(cue);
    const effect = this.createEffect();
    this.spawnTransientCue(cue, effect.id);
    this.refreshPools(0);
    return this.createEffectHandle(effect);
  }

  public sync(emitters: readonly PersistentWorldFxEmitter[]): void {
    this.requireAlive();
    this.syncGeneration += 1;
    for (const input of canonicalEmitters(emitters)) {
      validatePersistentEmitter(input);
      if (input.kind === "flame") this.syncFlameEmitter(input);
      else this.syncAuraEmitter(input);
    }
    pruneStaleEmitters(this.flameEmitters, this.syncGeneration);
    pruneStaleEmitters(this.auraEmitters, this.syncGeneration);
    this.refreshPools(0);
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    const elapsed = Number.isFinite(deltaSeconds) ? clamp(deltaSeconds, 0, MAX_DELTA_SECONDS) : 0;
    this.updateFlameEmitters(elapsed);
    this.updateAuraEmitters(elapsed);
    this.refreshPools(elapsed);
    this.settleCompletedEffects();
  }

  public getStats(): WorldFxStats {
    const additive = this.additive.getStats();
    const smoke = this.smoke.getStats();
    const rings = this.rings.getStats();
    return {
      activeAdditiveParticles: additive.activeCount,
      activeAuraEmitters: this.auraEmitters.size,
      activeEmitters: this.flameEmitters.size + this.auraEmitters.size,
      activeFlameEmitters: this.flameEmitters.size,
      activeRings: rings.activeCount,
      activeSmokeParticles: smoke.activeCount,
      activeTransientEffects: this.effects.size,
      additiveCapacity: additive.capacity,
      drawCalls: additive.drawCalls + smoke.drawCalls + rings.drawCalls,
      droppedCount: additive.droppedCount + smoke.droppedCount + rings.droppedCount,
      fingerprint: this.resolveFingerprint(),
      ringCapacity: rings.capacity,
      smokeCapacity: smoke.capacity,
      triangles: additive.triangles + smoke.triangles + rings.triangles,
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.flameEmitters.clear();
    this.auraEmitters.clear();
    for (const effect of this.effects.values()) this.settleEffect(effect);
    this.effects.clear();
    this.additive.dispose();
    this.smoke.dispose();
    this.rings.dispose();
    this.root.clear();
    this.root.removeFromParent();
  }

  private createEffect(): TransientEffectState {
    const id = this.nextEffectId++;
    let resolve = () => {};
    const promise = new Promise<void>((settle) => {
      resolve = settle;
    });
    const effect: TransientEffectState = { id, promise, resolve, settled: false };
    this.effects.set(id, effect);
    return effect;
  }

  private createEffectHandle(effect: TransientEffectState): WorldFxHandle {
    const release = () => this.releaseEffect(effect);
    return {
      dispose: release,
      end: release,
      promise: effect.promise,
    };
  }

  private releaseEffect(effect: TransientEffectState): void {
    if (effect.settled) return;
    this.additive.releaseEffect(effect.id);
    this.smoke.releaseEffect(effect.id);
    this.rings.releaseEffect(effect.id);
    this.settleEffect(effect);
    this.refreshPools(0);
  }

  private settleCompletedEffects(): void {
    for (const effect of this.effects.values()) {
      if (!this.additive.hasEffect(effect.id) && !this.smoke.hasEffect(effect.id) && !this.rings.hasEffect(effect.id)) {
        this.settleEffect(effect);
      }
    }
  }

  private settleEffect(effect: TransientEffectState): void {
    if (effect.settled) return;
    effect.settled = true;
    this.effects.delete(effect.id);
    effect.resolve();
  }

  private spawnTransientCue(cue: TransientWorldFxCue, effectId: number): void {
    switch (cue.kind) {
      case "impact":
        this.spawnImpact(cue, cue.normal ?? WORLD_UP, effectId);
        return;
      case "explosion":
        this.spawnExplosion(cue, cue.normal ?? WORLD_UP, effectId);
        return;
      case "shockwave":
        this.spawnShockwave(cue, cue.normal ?? WORLD_UP, effectId);
        return;
      case "beam":
        this.spawnEnergyPath(cue, effectId, "beam");
        return;
      case "projectile-trail":
        this.spawnEnergyPath(cue, effectId, "trail");
        return;
      case "dragon-breath":
        this.spawnDragonBreath(cue, effectId);
    }
  }

  private syncFlameEmitter(input: WorldFxFlameEmitter): void {
    const existing = this.flameEmitters.get(input.id);
    const emitter = existing ?? createFlameEmitterState(input.id);
    writeEmitterTransform(emitter, input, this.syncGeneration);
    this.flameEmitters.set(input.id, emitter);
    if (!existing) this.primeFlameEmitter(emitter);
  }

  private syncAuraEmitter(input: WorldFxAuraEmitter): void {
    const existing = this.auraEmitters.get(input.id);
    const emitter = existing ?? createAuraEmitterState(input.id);
    writeEmitterTransform(emitter, input, this.syncGeneration);
    emitter.style = input.style;
    this.auraEmitters.set(input.id, emitter);
    if (!existing) this.primeAuraEmitter(emitter);
  }

  private spawnImpact(cue: WorldFxImpactCue, normalInput: Readonly<Vector3>, effectId: number): void {
    const scale = requirePositive(cue.scale ?? 1, "impact scale");
    const tone = resolveTone(cue.tone ?? "physical");
    this.prepareSurfaceBasis(normalInput);
    const position = offsetAlongNormal(cue.position, this.normal, 0.025);
    this.spawnRing(effectId, position, this.normal, scale * 1.4, tone, 0.72, cue.seed);
    this.spawnFlash(effectId, position, this.normal, scale * 0.4, tone, 0.32, cue.seed);

    for (let index = 0; index < 18; index += 1) this.spawnImpactSpark(cue, effectId, index, scale, tone);
    for (let index = 0; index < 5; index += 1) this.spawnImpactSmoke(cue, effectId, index, scale);
  }

  private spawnExplosion(cue: WorldFxExplosionCue, normalInput: Readonly<Vector3>, effectId: number): void {
    const scale = requirePositive(cue.scale ?? 1, "explosion scale");
    const tone = resolveTone(cue.tone ?? "fire");
    this.prepareSurfaceBasis(normalInput);
    const position = offsetAlongNormal(cue.position, this.normal, 0.035);
    this.spawnRing(effectId, position, this.normal, scale * 1.7, tone, 0.95, cue.seed);
    this.spawnFlash(effectId, position, this.normal, scale * 0.55, tone, 0.18, cue.seed);
    for (let index = 0; index < 30; index += 1) this.spawnImpactSpark(cue, effectId, index, scale * 1.3, tone);
    for (let index = 0; index < 12; index += 1) this.spawnImpactSmoke(cue, effectId, index, scale * 1.45);
    for (let index = 0; index < 7; index += 1) this.spawnExplosionFireball(cue, effectId, index, scale);
  }

  private spawnShockwave(cue: WorldFxShockwaveCue, normalInput: Readonly<Vector3>, effectId: number): void {
    const scale = requirePositive(cue.scale ?? 1, "shockwave scale");
    const tone = resolveTone(cue.tone ?? "physical");
    this.prepareSurfaceBasis(normalInput);
    const position = offsetAlongNormal(cue.position, this.normal, 0.025);
    this.spawnRing(effectId, position, this.normal, scale * 2.5, tone, 0.9, cue.seed);
    this.spawnRing(effectId, position, this.normal, scale * 1.65, tone, 0.62, cue.seed ^ 0x9e3779b9);
    for (let index = 0; index < 8; index += 1) this.spawnImpactSmoke(cue, effectId, index, scale * 0.72);
  }

  private spawnEnergyPath(
    cue: WorldFxBeamCue | WorldFxProjectileTrailCue,
    effectId: number,
    style: "beam" | "trail",
  ): void {
    const scale = requirePositive(cue.scale ?? 1, `${style} scale`);
    const tone = resolveTone(cue.tone ?? "arcane");
    this.normal.copy(cue.to).sub(cue.from);
    const length = this.normal.length();
    if (length <= 1e-5) return;
    this.normal.multiplyScalar(1 / length);
    const spacing = style === "beam" ? 0.055 : 0.11;
    const count = Math.min(48, Math.max(4, Math.ceil(length / spacing)));
    for (let index = 0; index < count; index += 1) {
      const progress = count === 1 ? 0 : index / (count - 1);
      const taper = style === "beam" ? 1 : 0.38 + progress * 0.62;
      const jitter = (sampleUnit(cue.seed, index, 223) - 0.5) * scale * 0.025;
      this.additive.spawn({
        effectId,
        gravity: 0,
        kind: "energy",
        lifetimeSeconds: style === "beam" ? 0.42 : 0.72,
        positionX: cue.from.x + (cue.to.x - cue.from.x) * progress,
        positionY: cue.from.y + (cue.to.y - cue.from.y) * progress + jitter,
        positionZ: cue.from.z + (cue.to.z - cue.from.z) * progress,
        rotation: sampleUnit(cue.seed, index, 227) * Math.PI,
        size: scale * (style === "beam" ? 0.15 : 0.09) * taper,
        spin: (sampleUnit(cue.seed, index, 229) - 0.5) * 1.4,
        tone,
        velocityX: style === "beam" ? this.normal.x * scale * 0.08 : 0,
        velocityY: style === "beam" ? this.normal.y * scale * 0.08 : scale * 0.035,
        velocityZ: style === "beam" ? this.normal.z * scale * 0.08 : 0,
      });
    }
    this.spawnFlash(effectId, cue.to, this.normal, scale * (style === "beam" ? 0.18 : 0.13), tone, 0.34, cue.seed);
  }

  private spawnDragonBreath(cue: WorldFxDragonBreathCue, effectId: number): void {
    const scale = requirePositive(cue.scale ?? 1, "dragon breath scale");
    this.spawnEnergyPath({ ...cue, kind: "beam", tone: "fire" }, effectId, "beam");
    this.normal.copy(cue.to).sub(cue.from);
    const length = this.normal.length();
    if (length <= 1e-5) return;
    this.normal.multiplyScalar(1 / length);
    for (let index = 0; index < 18; index += 1) {
      const progress = (index + 1) / 19;
      const spread = scale * (0.025 + progress * 0.07);
      this.additive.spawn({
        effectId,
        gravity: 0.06,
        kind: "flame",
        lifetimeSeconds: 0.38 + sampleUnit(cue.seed, index, 233) * 0.24,
        positionX: cue.from.x + (cue.to.x - cue.from.x) * progress + (sampleUnit(cue.seed, index, 239) - 0.5) * spread,
        positionY: cue.from.y + (cue.to.y - cue.from.y) * progress + (sampleUnit(cue.seed, index, 241) - 0.5) * spread,
        positionZ: cue.from.z + (cue.to.z - cue.from.z) * progress + (sampleUnit(cue.seed, index, 251) - 0.5) * spread,
        rotation: (sampleUnit(cue.seed, index, 257) - 0.5) * 0.7,
        size: scale * (0.12 + progress * 0.11),
        spin: (sampleUnit(cue.seed, index, 263) - 0.5) * 0.8,
        tone: resolveTone("fire"),
        velocityX: this.normal.x * scale * 0.28,
        velocityY: this.normal.y * scale * 0.28 + scale * 0.08,
        velocityZ: this.normal.z * scale * 0.28,
      });
    }
    for (let index = 0; index < 5; index += 1) {
      this.spawnImpactSmoke({ position: cue.to, seed: cue.seed ^ 0x85ebca6b }, effectId, index, scale * 0.7);
    }
  }

  private spawnRing(
    effectId: number,
    position: Readonly<Vector3>,
    normal: Readonly<Vector3>,
    scale: number,
    tone: number,
    lifetimeSeconds: number,
    seed: number,
  ): void {
    this.rings.spawn({
      effectId,
      lifetimeSeconds,
      normalX: normal.x,
      normalY: normal.y,
      normalZ: normal.z,
      positionX: position.x,
      positionY: position.y,
      positionZ: position.z,
      rotation: sampleUnit(seed, 0, 91) * Math.PI * 2,
      scale,
      tone,
    });
  }

  private spawnFlash(
    effectId: number,
    position: Readonly<Vector3>,
    direction: Readonly<Vector3>,
    size: number,
    tone: number,
    lifetimeSeconds: number,
    seed: number,
  ): void {
    this.additive.spawn({
      effectId,
      gravity: 0,
      kind: "flash",
      lifetimeSeconds,
      positionX: position.x,
      positionY: position.y,
      positionZ: position.z,
      rotation: (sampleUnit(seed, 0, 97) - 0.5) * 0.12,
      size,
      spin: 0,
      tone,
      velocityX: direction.x * 0.15,
      velocityY: direction.y * 0.15,
      velocityZ: direction.z * 0.15,
    });
  }

  private spawnExplosionFireball(
    cue: Pick<WorldFxExplosionCue, "position" | "seed">,
    effectId: number,
    index: number,
    scale: number,
  ): void {
    const angle = sampleUnit(cue.seed, index, 269) * Math.PI * 2;
    const radius = scale * sampleUnit(cue.seed, index, 271) * 0.16;
    this.additive.spawn({
      effectId,
      gravity: 0.04,
      kind: "energy",
      lifetimeSeconds: 0.48 + sampleUnit(cue.seed, index, 277) * 0.24,
      positionX: cue.position.x + Math.cos(angle) * radius,
      positionY: cue.position.y + sampleUnit(cue.seed, index, 281) * scale * 0.1,
      positionZ: cue.position.z + Math.sin(angle) * radius,
      rotation: sampleUnit(cue.seed, index, 283) * Math.PI,
      size: scale * (0.27 + sampleUnit(cue.seed, index, 293) * 0.17),
      spin: (sampleUnit(cue.seed, index, 307) - 0.5) * 1.4,
      tone: resolveTone("fire"),
      velocityX: Math.cos(angle) * scale * 0.32,
      velocityY: scale * (0.24 + sampleUnit(cue.seed, index, 311) * 0.2),
      velocityZ: Math.sin(angle) * scale * 0.32,
    });
  }

  private spawnImpactSpark(
    cue: Pick<WorldFxImpactCue, "position" | "seed">,
    effectId: number,
    index: number,
    scale: number,
    tone: number,
  ): void {
    const angle = sampleUnit(cue.seed, index, 17) * Math.PI * 2;
    const radialSpeed = scale * (0.82 + sampleUnit(cue.seed, index, 23) * 1.28);
    const normalSpeed = scale * (0.28 + sampleUnit(cue.seed, index, 29) * 0.72);
    const tangentSpeed = Math.cos(angle) * radialSpeed;
    const bitangentSpeed = Math.sin(angle) * radialSpeed;
    this.additive.spawn({
      effectId,
      gravity: -3.1,
      kind: "spark",
      lifetimeSeconds: 0.34 + sampleUnit(cue.seed, index, 31) * 0.42,
      positionX: cue.position.x,
      positionY: cue.position.y,
      positionZ: cue.position.z,
      rotation: angle,
      size: scale * (0.036 + sampleUnit(cue.seed, index, 37) * 0.038),
      spin: (sampleUnit(cue.seed, index, 41) - 0.5) * 8,
      tone: Math.max(0.42, tone),
      velocityX: this.tangent.x * tangentSpeed + this.bitangent.x * bitangentSpeed + this.normal.x * normalSpeed,
      velocityY: this.tangent.y * tangentSpeed + this.bitangent.y * bitangentSpeed + this.normal.y * normalSpeed,
      velocityZ: this.tangent.z * tangentSpeed + this.bitangent.z * bitangentSpeed + this.normal.z * normalSpeed,
    });
  }

  private spawnImpactSmoke(
    cue: Pick<WorldFxImpactCue, "position" | "seed">,
    effectId: number,
    index: number,
    scale: number,
  ): void {
    const angle = sampleUnit(cue.seed, index, 53) * Math.PI * 2;
    const drift = scale * (0.12 + sampleUnit(cue.seed, index, 59) * 0.2);
    this.smoke.spawn({
      effectId,
      gravity: 0.025,
      kind: "smoke",
      lifetimeSeconds: 0.72 + sampleUnit(cue.seed, index, 61) * 0.55,
      positionX: cue.position.x,
      positionY: cue.position.y,
      positionZ: cue.position.z,
      rotation: angle,
      size: scale * (0.2 + sampleUnit(cue.seed, index, 67) * 0.12),
      spin: (sampleUnit(cue.seed, index, 71) - 0.5) * 1.5,
      tone: 0.42 + sampleUnit(cue.seed, index, 73) * 0.38,
      velocityX: Math.cos(angle) * drift + this.normal.x * 0.12,
      velocityY: 0.1 + this.normal.y * 0.09,
      velocityZ: Math.sin(angle) * drift + this.normal.z * 0.12,
    });
  }

  private resolveImpactBasis(): void {
    if (Math.abs(this.normal.y) < 0.9) this.tangent.set(0, 1, 0).cross(this.normal).normalize();
    else this.tangent.set(1, 0, 0).cross(this.normal).normalize();
    this.bitangent.copy(this.normal).cross(this.tangent).normalize();
  }

  private prepareSurfaceBasis(normalInput: Readonly<Vector3>): void {
    this.normal.copy(normalInput);
    if (this.normal.lengthSq() < 1e-8) this.normal.copy(WORLD_UP);
    else this.normal.normalize();
    this.resolveImpactBasis();
  }

  private primeFlameEmitter(emitter: FlameEmitterState): void {
    for (let index = 0; index < 3; index += 1) this.spawnFlameParticle(emitter);
    this.spawnFlameSmoke(emitter);
  }

  private updateFlameEmitters(deltaSeconds: number): void {
    for (const emitter of this.flameEmitters.values()) {
      emitter.elapsedSeconds += deltaSeconds * emitter.intensity;
      let emitted = 0;
      while (emitter.elapsedSeconds >= FLAME_INTERVAL_SECONDS && emitted < 4) {
        emitter.elapsedSeconds -= FLAME_INTERVAL_SECONDS;
        this.spawnFlameParticle(emitter);
        if (emitter.emissionIndex % 4 === 0) this.spawnFlameSmoke(emitter);
        if (emitter.emissionIndex % 7 === 0) this.spawnFlameEmber(emitter);
        emitted += 1;
      }
    }
  }

  private spawnFlameParticle(emitter: FlameEmitterState): void {
    const index = emitter.emissionIndex++;
    const angle = sampleUnit(emitter.seed, index, 101) * Math.PI * 2;
    const radius = emitter.scale * sampleUnit(emitter.seed, index, 103) * 0.09;
    this.additive.spawn({
      effectId: 0,
      gravity: 0.08,
      kind: "flame",
      lifetimeSeconds: 0.5 + sampleUnit(emitter.seed, index, 107) * 0.28,
      positionX: emitter.positionX + Math.cos(angle) * radius,
      positionY: emitter.positionY + sampleUnit(emitter.seed, index, 109) * 0.06 * emitter.scale,
      positionZ: emitter.positionZ + Math.sin(angle) * radius,
      rotation: (sampleUnit(emitter.seed, index, 127) - 0.5) * 0.2,
      size: emitter.scale * emitter.intensity * (0.16 + sampleUnit(emitter.seed, index, 113) * 0.09),
      spin: (sampleUnit(emitter.seed, index, 127) - 0.5) * 0.34,
      tone: 0.32 + sampleUnit(emitter.seed, index, 131) * 0.46,
      velocityX: (sampleUnit(emitter.seed, index, 137) - 0.5) * 0.1 * emitter.scale,
      velocityY: emitter.scale * (0.42 + sampleUnit(emitter.seed, index, 139) * 0.3),
      velocityZ: (sampleUnit(emitter.seed, index, 149) - 0.5) * 0.1 * emitter.scale,
    });
  }

  private spawnFlameSmoke(emitter: FlameEmitterState): void {
    const index = emitter.emissionIndex;
    const angle = sampleUnit(emitter.seed, index, 151) * Math.PI * 2;
    this.smoke.spawn({
      effectId: 0,
      gravity: 0.025,
      kind: "smoke",
      lifetimeSeconds: 1.05 + sampleUnit(emitter.seed, index, 157) * 0.55,
      positionX: emitter.positionX,
      positionY: emitter.positionY + emitter.scale * 0.32,
      positionZ: emitter.positionZ,
      rotation: angle,
      size: emitter.scale * (0.2 + sampleUnit(emitter.seed, index, 163) * 0.12),
      spin: (sampleUnit(emitter.seed, index, 167) - 0.5) * 0.7,
      tone: 0.22 + sampleUnit(emitter.seed, index, 173) * 0.28,
      velocityX: Math.cos(angle) * 0.07 * emitter.scale,
      velocityY: 0.28 * emitter.scale,
      velocityZ: Math.sin(angle) * 0.07 * emitter.scale,
    });
  }

  private spawnFlameEmber(emitter: FlameEmitterState): void {
    const index = emitter.emissionIndex;
    const angle = sampleUnit(emitter.seed, index, 179) * Math.PI * 2;
    this.additive.spawn({
      effectId: 0,
      gravity: -0.3,
      kind: "spark",
      lifetimeSeconds: 0.62 + sampleUnit(emitter.seed, index, 181) * 0.6,
      positionX: emitter.positionX,
      positionY: emitter.positionY + emitter.scale * 0.25,
      positionZ: emitter.positionZ,
      rotation: angle,
      size: emitter.scale * 0.035,
      spin: 0,
      tone: resolveTone("fire"),
      velocityX: Math.cos(angle) * 0.14 * emitter.scale,
      velocityY: (0.58 + sampleUnit(emitter.seed, index, 191) * 0.35) * emitter.scale,
      velocityZ: Math.sin(angle) * 0.14 * emitter.scale,
    });
  }

  private primeAuraEmitter(emitter: AuraEmitterState): void {
    this.spawnAuraPulse(emitter);
    for (let index = 0; index < 4; index += 1) this.spawnAuraMote(emitter);
  }

  private updateAuraEmitters(deltaSeconds: number): void {
    for (const emitter of this.auraEmitters.values()) {
      emitter.elapsedSeconds += deltaSeconds * emitter.intensity;
      let emitted = 0;
      while (emitter.elapsedSeconds >= AURA_INTERVAL_SECONDS && emitted < 2) {
        emitter.elapsedSeconds -= AURA_INTERVAL_SECONDS;
        this.spawnAuraMote(emitter);
        if (emitter.emissionIndex % 7 === 0) this.spawnAuraPulse(emitter);
        emitted += 1;
      }
    }
  }

  private spawnAuraPulse(emitter: AuraEmitterState): void {
    this.scratchPosition.set(emitter.positionX, emitter.positionY + 0.018, emitter.positionZ);
    this.spawnRing(
      0,
      this.scratchPosition,
      WORLD_UP,
      emitter.scale * 0.92,
      resolveAuraTone(emitter.style),
      1.15,
      emitter.seed ^ emitter.emissionIndex,
    );
  }

  private spawnAuraMote(emitter: AuraEmitterState): void {
    const index = emitter.emissionIndex++;
    const angle = sampleUnit(emitter.seed, index, 313) * Math.PI * 2;
    const radius = emitter.scale * (0.34 + sampleUnit(emitter.seed, index, 317) * 0.34);
    this.additive.spawn({
      effectId: 0,
      gravity: 0,
      kind: "energy",
      lifetimeSeconds: 0.72 + sampleUnit(emitter.seed, index, 331) * 0.5,
      positionX: emitter.positionX + Math.cos(angle) * radius,
      positionY: emitter.positionY + sampleUnit(emitter.seed, index, 337) * emitter.scale * 0.12,
      positionZ: emitter.positionZ + Math.sin(angle) * radius,
      rotation: angle,
      size: emitter.scale * (0.055 + sampleUnit(emitter.seed, index, 347) * 0.04),
      spin: (sampleUnit(emitter.seed, index, 349) - 0.5) * 1.2,
      tone: resolveAuraTone(emitter.style),
      velocityX: -Math.sin(angle) * emitter.scale * 0.08,
      velocityY: emitter.scale * 0.12,
      velocityZ: Math.cos(angle) * emitter.scale * 0.08,
    });
  }

  private refreshPools(deltaSeconds: number): void {
    this.additive.update(deltaSeconds, this.options.camera);
    this.smoke.update(deltaSeconds, this.options.camera);
    this.rings.update(deltaSeconds);
  }

  private resolveFingerprint(): string {
    let hash = 2_166_136_261;
    for (const emitter of this.flameEmitters.values()) {
      hash = hashString(hash, emitter.id);
      hash = hashNumber(hash, emitter.emissionIndex);
      hash = hashNumber(hash, Math.round(emitter.elapsedSeconds * 1_000));
    }
    for (const emitter of this.auraEmitters.values()) {
      hash = hashString(hash, emitter.id);
      hash = hashNumber(hash, emitter.emissionIndex);
      hash = hashNumber(hash, Math.round(emitter.elapsedSeconds * 1_000));
    }
    hash = this.additive.hashState(hash);
    hash = this.smoke.hashState(hash);
    hash = this.rings.hashState(hash);
    return hash.toString(16).padStart(8, "0");
  }

  private requireAlive(): void {
    if (this.disposed) throw new Error("World FX runtime is disposed");
  }
}

export function createWorldFxRuntime(options: CreateWorldFxRuntimeOptions): WorldFxRuntime {
  return new DefaultWorldFxRuntime(options);
}

function createFlameEmitterState(id: string): FlameEmitterState {
  return {
    emissionIndex: 0,
    elapsedSeconds: 0,
    id,
    intensity: 1,
    lastSeenGeneration: 0,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    scale: 1,
    seed: 0,
  };
}

function createAuraEmitterState(id: string): AuraEmitterState {
  return {
    emissionIndex: 0,
    elapsedSeconds: 0,
    id,
    intensity: 1,
    lastSeenGeneration: 0,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    scale: 1,
    seed: 0,
    style: "shield",
  };
}

function writeEmitterTransform(
  emitter: FlameEmitterState | AuraEmitterState,
  input: PersistentWorldFxEmitter,
  syncGeneration: number,
): void {
  const scale = requirePositive(input.scale ?? 1, `${input.kind} emitter ${input.id} scale`);
  emitter.intensity = clamp(input.intensity ?? 1, 0.05, 2);
  emitter.lastSeenGeneration = syncGeneration;
  emitter.positionX = input.position.x;
  emitter.positionY = input.position.y;
  emitter.positionZ = input.position.z;
  emitter.scale = scale;
  emitter.seed = input.seed >>> 0;
}

function pruneStaleEmitters<T extends { lastSeenGeneration: number }>(emitters: Map<string, T>, generation: number) {
  for (const [id, emitter] of emitters) {
    if (emitter.lastSeenGeneration !== generation) emitters.delete(id);
  }
}

function canonicalEmitters(emitters: readonly PersistentWorldFxEmitter[]): readonly PersistentWorldFxEmitter[] {
  for (let index = 1; index < emitters.length; index += 1) {
    if (emitters[index - 1].id > emitters[index].id)
      return emitters.toSorted((left, right) => left.id.localeCompare(right.id));
  }
  return emitters;
}

function sampleUnit(seed: number, index: number, salt: number): number {
  let value = (seed >>> 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_296;
}

function resolveTone(tone: WorldFxTone): number {
  if (tone === "fire") return 0.28;
  if (tone === "healing") return 0.62;
  return tone === "arcane" ? 1 : 0;
}

function resolveAuraTone(style: WorldFxAuraEmitter["style"]): number {
  if (style === "capture") return 0.18;
  return resolveTone(style === "healing" ? "healing" : "arcane");
}

function validateTransientCue(cue: TransientWorldFxCue): void {
  if (cue.kind === "beam" || cue.kind === "dragon-breath" || cue.kind === "projectile-trail") {
    requireFiniteVector(cue.from, `${cue.kind} start`);
    requireFiniteVector(cue.to, `${cue.kind} end`);
    return;
  }
  requireFiniteVector(cue.position, `${cue.kind} position`);
  requireFiniteVector(cue.normal ?? WORLD_UP, `${cue.kind} normal`);
}

function validatePersistentEmitter(emitter: PersistentWorldFxEmitter): void {
  if (!emitter.id) throw new Error("World FX emitters require a stable non-empty id");
  requireFiniteVector(emitter.position, `${emitter.kind} emitter ${emitter.id}`);
}

function offsetAlongNormal(position: Readonly<Vector3>, normal: Readonly<Vector3>, distance: number): Vector3 {
  return new Vector3(
    position.x + normal.x * distance,
    position.y + normal.y * distance,
    position.z + normal.z * distance,
  );
}

function requireFiniteVector(value: Readonly<Vector3>, label: string): void {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    throw new Error(`World FX ${label} requires finite coordinates`);
  }
}

function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`World FX ${label} must be positive`);
  return value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function hashString(hash: number, value: string): number {
  for (let index = 0; index < value.length; index += 1) hash = hashNumber(hash, value.charCodeAt(index));
  return hash;
}
