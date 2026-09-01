import {
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import * as ThreeWebGPU from "three/webgpu";
import { attribute, color, mix, smoothstep, uniform, uv } from "three/tsl";
import type UniformNode from "three/src/nodes/core/UniformNode.js";
import type MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";

export const TERRAIN_DUST_INTERACTION_CAPACITY = 128;
export const TERRAIN_DUST_EMITTER_CAPACITY = 256;

export type TerrainDustSurface = "damp" | "dry" | "grass";

export interface TerrainDustInteraction {
  entityId: number;
  groundY: number;
  isMoving: boolean;
  surface: TerrainDustSurface;
  worldX: number;
  worldZ: number;
  yaw: number;
}

export interface TerrainDustInteractionStats {
  activeParticles: number;
  capacity: number;
  drawCalls: number;
  emitters: number;
  triangles: number;
}

interface DustEmitterState {
  emissionIndex: number;
  elapsedSeconds: number;
  groundY: number;
  lastSeenGeneration: number;
  surface: TerrainDustSurface;
  worldX: number;
  worldZ: number;
  yaw: number;
}

interface DustParticleState {
  active: boolean;
  ageSeconds: number;
  groundY: number;
  lifetimeSeconds: number;
  opacity: number;
  phase: number;
  size: number;
  tone: number;
  worldX: number;
  worldZ: number;
}

interface DustSurfaceProfile {
  emissionIntervalSeconds: number;
  opacity: number;
  size: number;
  tone: number;
}

const DUST_ATTRIBUTE = "terrainDustInteraction";
const MeshBasicNodeMaterialConstructor = (
  ThreeWebGPU as unknown as { MeshBasicNodeMaterial: new () => MeshBasicNodeMaterial }
).MeshBasicNodeMaterial;
const DUST_SURFACE_PROFILES: Readonly<Record<TerrainDustSurface, DustSurfaceProfile>> = Object.freeze({
  damp: { emissionIntervalSeconds: 0.24, opacity: 0.22, size: 0.2, tone: 0 },
  dry: { emissionIntervalSeconds: 0.13, opacity: 0.72, size: 0.3, tone: 1 },
  grass: { emissionIntervalSeconds: 0.18, opacity: 0.42, size: 0.24, tone: 0.35 },
});

export class TerrainDustInteractionPool {
  readonly object3d = new Group();
  private readonly geometry = createDustGeometry();
  private readonly strength = uniform(1, "float");
  private readonly material = createDustMaterial(this.strength);
  private readonly mesh = new InstancedMesh(this.geometry, this.material, TERRAIN_DUST_INTERACTION_CAPACITY);
  private readonly dustAttribute = new InstancedBufferAttribute(
    new Float32Array(TERRAIN_DUST_INTERACTION_CAPACITY * 3),
    3,
  );
  private readonly emitters = new Map<number, DustEmitterState>();
  private readonly particles = Array.from({ length: TERRAIN_DUST_INTERACTION_CAPACITY }, createInactiveParticle);
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3();
  private activeParticleCount = 0;
  private strengthValue = 1;
  private syncGeneration = 0;
  private writeIndex = 0;

  constructor() {
    this.object3d.name = "terrain-dust-interactions";
    this.mesh.name = "terrain-dust-interaction-pool";
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.raycast = disableDustRaycast;
    this.dustAttribute.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute(DUST_ATTRIBUTE, this.dustAttribute);
    this.object3d.add(this.mesh);
  }

  sync(interactions: readonly TerrainDustInteraction[]): void {
    interactions.forEach(requireFiniteDustInteraction);
    this.syncGeneration += 1;
    const canonical = canonicalDustInteractions(interactions);
    let retainedEmitters = 0;
    for (const interaction of canonical) {
      if (!interaction.isMoving || retainedEmitters >= TERRAIN_DUST_EMITTER_CAPACITY) continue;
      this.syncEmitter(interaction);
      retainedEmitters += 1;
    }
    this.pruneStaleEmitters();
  }

  update(deltaSeconds: number): void {
    const clampedDelta = Math.min(0.05, Math.max(0, deltaSeconds));
    this.advanceParticles(clampedDelta);
    if (this.strengthValue > 0) this.emitDueParticles(clampedDelta);
    this.writeActiveParticles();
  }

  setStrength(strength: number): void {
    this.strengthValue = clampUnit(strength);
    this.strength.value = this.strengthValue;
    if (this.strengthValue === 0) {
      this.clearParticles();
      this.resetEmitterCadence();
    }
    this.mesh.visible = this.activeParticleCount > 0 && this.strengthValue > 0;
  }

  getStats(): TerrainDustInteractionStats {
    const visible = this.mesh.visible;
    return {
      activeParticles: visible ? this.activeParticleCount : 0,
      capacity: TERRAIN_DUST_INTERACTION_CAPACITY,
      drawCalls: visible ? 1 : 0,
      emitters: this.strengthValue > 0 ? this.emitters.size : 0,
      triangles: visible ? this.activeParticleCount * 2 : 0,
    };
  }

  clear(): void {
    this.emitters.clear();
    this.clearParticles();
  }

  dispose(): void {
    this.clear();
    this.object3d.clear();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  private syncEmitter(interaction: TerrainDustInteraction): void {
    const existing = this.emitters.get(interaction.entityId);
    const profile = DUST_SURFACE_PROFILES[interaction.surface];
    const emitter = existing ?? {
      emissionIndex: 0,
      elapsedSeconds: profile.emissionIntervalSeconds,
      groundY: interaction.groundY,
      lastSeenGeneration: this.syncGeneration,
      surface: interaction.surface,
      worldX: interaction.worldX,
      worldZ: interaction.worldZ,
      yaw: interaction.yaw,
    };
    emitter.groundY = interaction.groundY;
    emitter.lastSeenGeneration = this.syncGeneration;
    emitter.surface = interaction.surface;
    emitter.worldX = interaction.worldX;
    emitter.worldZ = interaction.worldZ;
    emitter.yaw = interaction.yaw;
    this.emitters.set(interaction.entityId, emitter);
  }

  private pruneStaleEmitters(): void {
    for (const [entityId, emitter] of this.emitters) {
      if (emitter.lastSeenGeneration !== this.syncGeneration) this.emitters.delete(entityId);
    }
  }

  private advanceParticles(deltaSeconds: number): void {
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.ageSeconds += deltaSeconds;
      if (particle.ageSeconds >= particle.lifetimeSeconds) particle.active = false;
    }
  }

  private emitDueParticles(deltaSeconds: number): void {
    for (const [entityId, emitter] of this.emitters) {
      const profile = DUST_SURFACE_PROFILES[emitter.surface];
      emitter.elapsedSeconds += deltaSeconds;
      if (emitter.elapsedSeconds < profile.emissionIntervalSeconds) continue;
      emitter.elapsedSeconds %= profile.emissionIntervalSeconds;
      this.emitParticle(entityId, emitter, profile);
    }
  }

  private emitParticle(entityId: number, emitter: DustEmitterState, profile: DustSurfaceProfile): void {
    const particle = this.particles[this.writeIndex % TERRAIN_DUST_INTERACTION_CAPACITY];
    const phase = interactionPhase(entityId, emitter.emissionIndex);
    const side = emitter.emissionIndex % 2 === 0 ? -1 : 1;
    const forwardX = Math.sin(emitter.yaw);
    const forwardZ = Math.cos(emitter.yaw);
    const rightX = Math.cos(emitter.yaw);
    const rightZ = -Math.sin(emitter.yaw);
    particle.active = true;
    particle.ageSeconds = 0;
    particle.groundY = emitter.groundY;
    particle.lifetimeSeconds = 0.52 + phase * 0.18;
    particle.opacity = profile.opacity;
    particle.phase = phase;
    particle.size = profile.size * (0.88 + phase * 0.24);
    particle.tone = profile.tone;
    particle.worldX = emitter.worldX - forwardX * 0.16 + rightX * side * 0.11;
    particle.worldZ = emitter.worldZ - forwardZ * 0.16 + rightZ * side * 0.11;
    emitter.emissionIndex += 1;
    this.writeIndex += 1;
  }

  private writeActiveParticles(): void {
    let activeCount = 0;
    for (const particle of this.particles) {
      if (!particle.active) continue;
      const progress = particle.ageSeconds / particle.lifetimeSeconds;
      const expansion = particle.size * (0.72 + progress * 1.08);
      this.position.set(particle.worldX, particle.groundY + 0.018 + progress * 0.035, particle.worldZ);
      this.scale.set(expansion, 1, expansion);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(activeCount, this.matrix);
      this.dustAttribute.setXYZ(activeCount, (1 - progress) ** 2 * particle.opacity, particle.phase, particle.tone);
      activeCount += 1;
    }
    this.activeParticleCount = activeCount;
    this.mesh.count = activeCount;
    this.mesh.visible = activeCount > 0 && this.strengthValue > 0;
    this.mesh.instanceMatrix.needsUpdate = activeCount > 0;
    this.dustAttribute.needsUpdate = activeCount > 0;
  }

  private clearParticles(): void {
    this.particles.forEach((particle) => {
      particle.active = false;
    });
    this.activeParticleCount = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  private resetEmitterCadence(): void {
    this.emitters.forEach((emitter) => {
      emitter.elapsedSeconds = DUST_SURFACE_PROFILES[emitter.surface].emissionIntervalSeconds;
    });
  }
}

function createDustGeometry(): PlaneGeometry {
  const geometry = new PlaneGeometry(1, 1, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.name = "terrain-dust-interaction-geometry";
  return geometry;
}

function createDustMaterial(strength: UniformNode<"float", number>): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterialConstructor();
  material.name = "terrain-dust-interactions";
  material.transparent = true;
  material.depthWrite = false;
  material.alphaTest = 0.01;
  const interaction = attribute<"vec3">(DUST_ATTRIBUTE, "vec3").clamp(0, 1);
  const coordinates = uv().sub(0.5).mul(2);
  const radial = smoothstep(0.18, 1, coordinates.length()).oneMinus();
  const breakup = coordinates.x
    .mul(11.3)
    .add(coordinates.y.mul(7.1))
    .add(interaction.y.mul(9.7))
    .sin()
    .mul(0.16)
    .add(0.84);
  material.colorNode = mix(color("#9d9273"), color("#d0aa6b"), interaction.z);
  material.opacityNode = radial.mul(breakup).mul(interaction.x).mul(strength).mul(0.72).clamp(0, 0.52);
  return material;
}

function canonicalDustInteractions(interactions: readonly TerrainDustInteraction[]): readonly TerrainDustInteraction[] {
  for (let index = 1; index < interactions.length; index += 1) {
    if (interactions[index - 1].entityId > interactions[index].entityId) {
      return interactions.toSorted((left, right) => left.entityId - right.entityId);
    }
  }
  return interactions;
}

function createInactiveParticle(): DustParticleState {
  return {
    active: false,
    ageSeconds: 0,
    groundY: 0,
    lifetimeSeconds: 0,
    opacity: 0,
    phase: 0,
    size: 0,
    tone: 0,
    worldX: 0,
    worldZ: 0,
  };
}

function interactionPhase(entityId: number, emissionIndex: number): number {
  const value = Math.sin(entityId * 12.9898 + emissionIndex * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

function requireFiniteDustInteraction(interaction: TerrainDustInteraction): void {
  if (
    !Number.isFinite(interaction.entityId) ||
    !Number.isFinite(interaction.groundY) ||
    !Number.isFinite(interaction.worldX) ||
    !Number.isFinite(interaction.worldZ) ||
    !Number.isFinite(interaction.yaw)
  ) {
    throw new Error(`Terrain dust interaction requires finite values: ${JSON.stringify(interaction)}`);
  }
}

function disableDustRaycast(raycaster: unknown, intersects: unknown[]): void {
  void raycaster;
  void intersects;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
