import { Camera, Group, Scene, Vector3 } from "three";

import { WorldFxParticlePool, WorldFxRingPool, hashNumber } from "./world-fx-pools";

export type WorldFxTone = "arcane" | "physical";

export interface WorldFxImpactCue {
  kind: "impact";
  normal?: Readonly<Vector3>;
  position: Readonly<Vector3>;
  scale?: number;
  seed: number;
  tone?: WorldFxTone;
}

export type TransientWorldFxCue = WorldFxImpactCue;

interface WorldFxFlameEmitter {
  id: string;
  intensity?: number;
  kind: "flame";
  position: Readonly<Vector3>;
  scale?: number;
  seed: number;
}

export type PersistentWorldFxEmitter = WorldFxFlameEmitter;

export interface WorldFxHandle {
  dispose(): void;
  end(): void;
  promise: Promise<void>;
}

export interface WorldFxStats {
  activeAdditiveParticles: number;
  activeEmitters: number;
  activeRings: number;
  activeSmokeParticles: number;
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
const WORLD_UP = new Vector3(0, 1, 0);

class DefaultWorldFxRuntime implements WorldFxRuntime {
  private readonly root = new Group();
  private readonly additive = new WorldFxParticlePool("additive", ADDITIVE_CAPACITY);
  private readonly smoke = new WorldFxParticlePool("smoke", SMOKE_CAPACITY);
  private readonly rings = new WorldFxRingPool(RING_CAPACITY);
  private readonly emitters = new Map<string, FlameEmitterState>();
  private readonly effects = new Map<number, TransientEffectState>();
  private readonly normal = new Vector3();
  private readonly tangent = new Vector3();
  private readonly bitangent = new Vector3();
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
    requireFiniteVector(cue.position, "impact position");
    const normal = cue.normal ?? WORLD_UP;
    requireFiniteVector(normal, "impact normal");
    const effect = this.createEffect();
    this.spawnImpact(cue, normal, effect.id);
    this.refreshPools(0);
    return this.createEffectHandle(effect);
  }

  public sync(emitters: readonly PersistentWorldFxEmitter[]): void {
    this.requireAlive();
    this.syncGeneration += 1;
    for (const input of canonicalEmitters(emitters)) {
      requireFiniteVector(input.position, `flame emitter ${input.id}`);
      if (!input.id) throw new Error("World FX flame emitters require a stable non-empty id");
      const scale = requirePositive(input.scale ?? 1, `flame emitter ${input.id} scale`);
      const intensity = clamp(input.intensity ?? 1, 0.05, 2);
      const existing = this.emitters.get(input.id);
      const emitter = existing ?? createFlameEmitterState(input.id);
      emitter.intensity = intensity;
      emitter.lastSeenGeneration = this.syncGeneration;
      emitter.positionX = input.position.x;
      emitter.positionY = input.position.y;
      emitter.positionZ = input.position.z;
      emitter.scale = scale;
      emitter.seed = input.seed >>> 0;
      this.emitters.set(input.id, emitter);
      if (!existing) this.primeFlameEmitter(emitter);
    }
    for (const [id, emitter] of this.emitters) {
      if (emitter.lastSeenGeneration !== this.syncGeneration) this.emitters.delete(id);
    }
    this.refreshPools(0);
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    const elapsed = Number.isFinite(deltaSeconds) ? clamp(deltaSeconds, 0, MAX_DELTA_SECONDS) : 0;
    this.updateFlameEmitters(elapsed);
    this.refreshPools(elapsed);
    this.settleCompletedEffects();
  }

  public getStats(): WorldFxStats {
    const additive = this.additive.getStats();
    const smoke = this.smoke.getStats();
    const rings = this.rings.getStats();
    return {
      activeAdditiveParticles: additive.activeCount,
      activeEmitters: this.emitters.size,
      activeRings: rings.activeCount,
      activeSmokeParticles: smoke.activeCount,
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
    this.emitters.clear();
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

  private spawnImpact(cue: WorldFxImpactCue, normalInput: Readonly<Vector3>, effectId: number): void {
    const scale = requirePositive(cue.scale ?? 1, "impact scale");
    const tone = resolveTone(cue.tone ?? "physical");
    this.normal.copy(normalInput);
    if (this.normal.lengthSq() < 1e-8) this.normal.copy(WORLD_UP);
    else this.normal.normalize();
    this.resolveImpactBasis();

    const positionX = cue.position.x + this.normal.x * 0.025;
    const positionY = cue.position.y + this.normal.y * 0.025;
    const positionZ = cue.position.z + this.normal.z * 0.025;
    this.rings.spawn({
      effectId,
      lifetimeSeconds: 0.72,
      normalX: this.normal.x,
      normalY: this.normal.y,
      normalZ: this.normal.z,
      positionX,
      positionY,
      positionZ,
      rotation: sampleUnit(cue.seed, 0, 91) * Math.PI * 2,
      scale: scale * 1.4,
      tone,
    });
    this.additive.spawn({
      effectId,
      gravity: 0,
      kind: "flame",
      lifetimeSeconds: 0.2,
      positionX,
      positionY,
      positionZ,
      rotation: 0,
      size: scale * 0.58,
      spin: 0,
      tone: Math.max(0.65, tone),
      velocityX: this.normal.x * 0.15,
      velocityY: this.normal.y * 0.15,
      velocityZ: this.normal.z * 0.15,
    });

    for (let index = 0; index < 18; index += 1) this.spawnImpactSpark(cue, effectId, index, scale, tone);
    for (let index = 0; index < 5; index += 1) this.spawnImpactSmoke(cue, effectId, index, scale);
  }

  private spawnImpactSpark(cue: WorldFxImpactCue, effectId: number, index: number, scale: number, tone: number): void {
    const angle = sampleUnit(cue.seed, index, 17) * Math.PI * 2;
    const radialSpeed = scale * (0.75 + sampleUnit(cue.seed, index, 23) * 1.15);
    const normalSpeed = scale * (0.35 + sampleUnit(cue.seed, index, 29) * 0.85);
    const tangentSpeed = Math.cos(angle) * radialSpeed;
    const bitangentSpeed = Math.sin(angle) * radialSpeed;
    this.additive.spawn({
      effectId,
      gravity: -2.4,
      kind: "spark",
      lifetimeSeconds: 0.34 + sampleUnit(cue.seed, index, 31) * 0.42,
      positionX: cue.position.x,
      positionY: cue.position.y,
      positionZ: cue.position.z,
      rotation: angle,
      size: scale * (0.045 + sampleUnit(cue.seed, index, 37) * 0.045),
      spin: (sampleUnit(cue.seed, index, 41) - 0.5) * 8,
      tone: Math.max(0.42, tone),
      velocityX: this.tangent.x * tangentSpeed + this.bitangent.x * bitangentSpeed + this.normal.x * normalSpeed,
      velocityY: this.tangent.y * tangentSpeed + this.bitangent.y * bitangentSpeed + this.normal.y * normalSpeed,
      velocityZ: this.tangent.z * tangentSpeed + this.bitangent.z * bitangentSpeed + this.normal.z * normalSpeed,
    });
  }

  private spawnImpactSmoke(cue: WorldFxImpactCue, effectId: number, index: number, scale: number): void {
    const angle = sampleUnit(cue.seed, index, 53) * Math.PI * 2;
    const drift = scale * (0.08 + sampleUnit(cue.seed, index, 59) * 0.16);
    this.smoke.spawn({
      effectId,
      gravity: 0.04,
      kind: "smoke",
      lifetimeSeconds: 0.72 + sampleUnit(cue.seed, index, 61) * 0.55,
      positionX: cue.position.x,
      positionY: cue.position.y,
      positionZ: cue.position.z,
      rotation: angle,
      size: scale * (0.16 + sampleUnit(cue.seed, index, 67) * 0.12),
      spin: (sampleUnit(cue.seed, index, 71) - 0.5) * 1.5,
      tone: 0.35 + sampleUnit(cue.seed, index, 73) * 0.35,
      velocityX: Math.cos(angle) * drift + this.normal.x * 0.12,
      velocityY: 0.16 + this.normal.y * 0.12,
      velocityZ: Math.sin(angle) * drift + this.normal.z * 0.12,
    });
  }

  private resolveImpactBasis(): void {
    if (Math.abs(this.normal.y) < 0.9) this.tangent.set(0, 1, 0).cross(this.normal).normalize();
    else this.tangent.set(1, 0, 0).cross(this.normal).normalize();
    this.bitangent.copy(this.normal).cross(this.tangent).normalize();
  }

  private primeFlameEmitter(emitter: FlameEmitterState): void {
    for (let index = 0; index < 3; index += 1) this.spawnFlameParticle(emitter);
    this.spawnFlameSmoke(emitter);
  }

  private updateFlameEmitters(deltaSeconds: number): void {
    for (const emitter of this.emitters.values()) {
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
      rotation: angle,
      size: emitter.scale * emitter.intensity * (0.15 + sampleUnit(emitter.seed, index, 113) * 0.1),
      spin: (sampleUnit(emitter.seed, index, 127) - 0.5) * 2.2,
      tone: 0.32 + sampleUnit(emitter.seed, index, 131) * 0.46,
      velocityX: (sampleUnit(emitter.seed, index, 137) - 0.5) * 0.13 * emitter.scale,
      velocityY: emitter.scale * (0.48 + sampleUnit(emitter.seed, index, 139) * 0.34),
      velocityZ: (sampleUnit(emitter.seed, index, 149) - 0.5) * 0.13 * emitter.scale,
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
      positionY: emitter.positionY + emitter.scale * 0.28,
      positionZ: emitter.positionZ,
      rotation: angle,
      size: emitter.scale * (0.22 + sampleUnit(emitter.seed, index, 163) * 0.13),
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
      tone: 0.82,
      velocityX: Math.cos(angle) * 0.14 * emitter.scale,
      velocityY: (0.58 + sampleUnit(emitter.seed, index, 191) * 0.35) * emitter.scale,
      velocityZ: Math.sin(angle) * 0.14 * emitter.scale,
    });
  }

  private refreshPools(deltaSeconds: number): void {
    this.additive.update(deltaSeconds, this.options.camera);
    this.smoke.update(deltaSeconds, this.options.camera);
    this.rings.update(deltaSeconds);
  }

  private resolveFingerprint(): string {
    let hash = 2_166_136_261;
    for (const emitter of this.emitters.values()) {
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
  return tone === "arcane" ? 1 : 0;
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
