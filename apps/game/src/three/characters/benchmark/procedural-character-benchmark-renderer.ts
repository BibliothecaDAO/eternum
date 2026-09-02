import {
  applyProceduralCharacterConfigPatch,
  applyProceduralUnitConfigPatch,
  createDefaultProceduralUnitConfig,
  type ProceduralUnitActor,
  type ProceduralUnitConfig,
  type ProceduralUnitKind,
  type ProceduralUnitRuntime,
} from "@/three/characters";
import { TroopTier } from "@bibliothecadao/types";
import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { getRendererDiagnosticActiveMode } from "@/three/renderer-diagnostics";
import { ArrowProjectileSystem } from "@/three/projectiles/arrow-projectile-system";
import { MeleeImpactSystem } from "@/three/combat/melee-impact-system";
import { configureGltfTextureSupport } from "@/three/utils/utils";
import {
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  Vector3,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { initializeProceduralCharacterRendererRuntime } from "../procedural-character-renderer-runtime";
import {
  createProceduralCollisionBudget,
  createProceduralCollisionProfile,
} from "../collision/procedural-collision-profile";
import {
  ProceduralSeparationSimulation,
  type ProceduralSeparationInput,
} from "../collision/procedural-separation-simulation";
import {
  applyProceduralCharacterBenchmarkConfigPatch,
  type ProceduralCharacterBenchmarkConfig,
} from "./procedural-character-benchmark-config";
import {
  advanceProceduralCharacterBenchmarkSimulation,
  BENCHMARK_FIXED_STEP_SECONDS,
  BENCHMARK_HEX_CELLS,
  createProceduralCharacterBenchmarkSimulation,
  killProceduralCharacterBenchmarkAgents,
  resolveProceduralCharacterBenchmarkSimulationSnapshot,
  writeBenchmarkAgentPosition,
  type BenchmarkAgentSimulationState,
  type ProceduralCharacterBenchmarkEvent,
  type ProceduralCharacterBenchmarkSimulationState,
} from "./procedural-character-benchmark-simulation";
import { ProceduralCharacterGpuTimer } from "./procedural-character-gpu-timer";
import {
  ProceduralCharacterPerformanceEvaluator,
  type ProceduralCharacterPerformanceEvaluation,
} from "./procedural-character-performance-evaluation";
import { ProceduralWorldGymEnvironment } from "./procedural-world-gym-environment";

export type ProceduralCharacterBenchmarkEnvironment = "hex" | "procedural-biomes";

export interface ProceduralCharacterBenchmarkStats {
  actorCount: number;
  animationUpdateLaneCount: number;
  averageFrameMs: number;
  collisionBodyCount: number;
  collisionCandidatePairCount: number;
  collisionDroppedPairCount: number;
  collisionMaximumOffset: number;
  collisionResolvedPairCount: number;
  drawCalls: number;
  environmentMode: ProceduralCharacterBenchmarkEnvironment;
  fps: number;
  geometryCount: number;
  hexCount: number;
  loadingActors: boolean;
  meleeActiveImpactCount: number;
  meleeContactCount: number;
  meleeDroppedCount: number;
  maximumAnimatedMountBoneStretchRatio: number;
  maximumLoadingMountHoofReach: number;
  maximumRagdollMountBoneStretchRatio: number;
  p95FrameMs: number;
  physicsBodyCount: number;
  physicsConstraintCount: number;
  physicsFailures: readonly string[];
  pixelRatio: number;
  performance: ProceduralCharacterPerformanceEvaluation;
  projectileActiveCount: number;
  projectileDroppedCount: number;
  projectileHitCount: number;
  projectileStuckCount: number;
  ragdollCount: number;
  rendererMode: string;
  resetCount: number;
  respawnCount: number;
  runningCount: number;
  simulationElapsedSeconds: number;
  simulationSteps: number;
  textureCount: number;
  terrainBiomeCount: number;
  terrainCellCount: number;
  terrainGroundedActorCount: number;
  terrainMaximumRootError: number;
  terrainPropCount: number;
  terrainSurfaceMissCount: number;
  terrainTriangles: number;
  totalDeaths: number;
  triangles: number;
  visibleHexCount: number;
  wasmHeapMiB: number;
}

export interface ProceduralCharacterBenchmarkRendererHandle {
  dispose(): void;
  killBurst(count?: number): void;
  reset(): void;
  resetCamera(): void;
  setPaused(paused: boolean): void;
  startPerformanceEvaluation(): Promise<void>;
  stepOnce(): void;
  updateConfig(config: ProceduralCharacterBenchmarkConfig): Promise<void>;
}

interface MountProceduralCharacterBenchmarkRendererInput {
  config: ProceduralCharacterBenchmarkConfig;
  container: HTMLElement;
  environment?: ProceduralCharacterBenchmarkEnvironment;
  onStats?: (stats: ProceduralCharacterBenchmarkStats) => void;
}

interface AnimationLoopRenderer extends RendererSurfaceLike {
  getContext?(): WebGLRenderingContext;
  setAnimationLoop(callback: ((time: number) => void) | null): void;
}

interface BenchmarkActorRecord {
  actor: ProceduralUnitActor;
  collisionInput: ProceduralSeparationInput;
  contactActive: boolean;
  physicsGeneration: number;
  unsubscribeMeleeContact: () => void;
}

const HEX_RADIUS = 1;
const ACTOR_GROUND_Y = 0.08;
const MAX_SIMULATION_STEPS = 4;
const STATS_INTERVAL_MS = 250;
const ACTOR_BUILD_BATCH_SIZE = 5;
const BENCHMARK_ARROW_CAPACITY = 512;
const BENCHMARK_ARCHER_VOLLEYS_PER_SECOND = 12;
const BENCHMARK_MELEE_ATTACKS_PER_SECOND = 10;
const CHARACTER_PALETTE = ["#4ade80", "#60a5fa", "#f97316", "#c084fc", "#facc15", "#fb7185"] as const;
const BENCHMARK_COLLISION_BUDGET = createProceduralCollisionBudget("benchmark");

export async function mountProceduralCharacterBenchmarkRenderer(
  input: MountProceduralCharacterBenchmarkRendererInput,
): Promise<ProceduralCharacterBenchmarkRendererHandle> {
  const benchmark = await ProceduralCharacterBenchmarkRuntime.create(input);
  return benchmark.createHandle();
}

class ProceduralCharacterBenchmarkRuntime {
  private readonly backend: Awaited<
    ReturnType<typeof initializeProceduralCharacterRendererRuntime>
  >["rendererRuntime"]["backend"];
  private readonly renderer: AnimationLoopRenderer;
  private readonly scene: Scene;
  private readonly camera: OrthographicCamera;
  private readonly controls: OrbitControls;
  private readonly environmentMode: ProceduralCharacterBenchmarkEnvironment;
  private readonly stage = new Group();
  private readonly resizeObserver: ResizeObserver;
  private readonly unitRuntime: ProceduralUnitRuntime;
  private readonly worldGymEnvironment?: ProceduralWorldGymEnvironment;
  private readonly projectiles = new ArrowProjectileSystem({
    capacity: BENCHMARK_ARROW_CAPACITY,
    fixedStep: 1 / 60,
    gravity: -6.8,
    maxSubsteps: 4,
    stickSeconds: 2.5,
    sweepRadius: 0.035,
    visualScale: 0.45,
  });
  private readonly meleeImpacts = new MeleeImpactSystem(256);
  private readonly actors = new Map<number, BenchmarkActorRecord>();
  private readonly collisionInputs: ProceduralSeparationInput[] = [];
  private readonly separation = new ProceduralSeparationSimulation({
    maxNeighborsPerBody: BENCHMARK_COLLISION_BUDGET.maxNeighborsPerBody,
    maxPairResolutions: BENCHMARK_COLLISION_BUDGET.maxPairResolutions,
  });
  private readonly performanceEvaluator = new ProceduralCharacterPerformanceEvaluator();
  private readonly gpuTimer: ProceduralCharacterGpuTimer;
  private readonly positionScratch = new Vector3();
  private readonly targetScratch = new Vector3();
  private readonly onStats?: (stats: ProceduralCharacterBenchmarkStats) => void;
  private config: ProceduralCharacterBenchmarkConfig;
  private simulation: ProceduralCharacterBenchmarkSimulationState;
  private populationGeneration = 0;
  private simulationAccumulator = 0;
  private simulationSteps = 0;
  private archerVolleyAccumulator = 0;
  private archerVolleyCursor = 0;
  private meleeAttackAccumulator = 0;
  private meleeAttackCursor = 0;
  private resetCount = 0;
  private collisionCpuMs = 0;
  private maximumCollisionDroppedPairCount = 0;
  private physicsFailures: string[] = [];
  private loadingActors = true;
  private maximumLoadingMountHoofReach = 0;
  private paused = false;
  private disposed = false;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private lastFrameTime = performance.now();
  private lastStatsTime = this.lastFrameTime;
  private performanceEvaluationPromise?: Promise<void>;

  private constructor(
    input: MountProceduralCharacterBenchmarkRendererInput,
    initialized: Awaited<ReturnType<typeof initializeProceduralCharacterRendererRuntime>>["rendererRuntime"],
    unitRuntime: ProceduralUnitRuntime,
    worldGymEnvironment?: ProceduralWorldGymEnvironment,
  ) {
    this.config = input.config;
    this.onStats = input.onStats;
    this.backend = initialized.backend;
    this.renderer = initialized.renderer as AnimationLoopRenderer;
    this.gpuTimer = new ProceduralCharacterGpuTimer(this.renderer);
    this.performanceEvaluator.setGpuTimerSupported(this.gpuTimer.supported);
    this.unitRuntime = unitRuntime;
    this.environmentMode = input.environment ?? "hex";
    this.worldGymEnvironment = worldGymEnvironment;
    this.unitRuntime.updatePhysicsConfig(createDefaultProceduralUnitConfig().humanoid);
    this.unitRuntime.setCrowdAnimationLaneCount(this.config.animationUpdateLanes);
    this.simulation = createProceduralCharacterBenchmarkSimulation(this.config);
    this.scene = createBenchmarkScene(this.stage, this.worldGymEnvironment);
    this.stage.add(this.projectiles.group, this.meleeImpacts.group);
    this.camera = createBenchmarkCamera();
    this.controls = createBenchmarkControls(this.camera, this.renderer.domElement);
    this.controls.autoRotate = this.config.autoRotate;
    this.renderer.domElement.id =
      this.environmentMode === "procedural-biomes"
        ? "procedural-world-gym-canvas"
        : "procedural-character-benchmark-canvas";
    this.renderer.domElement.setAttribute(
      "aria-label",
      this.environmentMode === "procedural-biomes"
        ? "One hundred procedural characters walking across generated fantasy biomes"
        : "One hundred procedural characters on a complete hex map",
    );
    this.renderer.domElement.className = "h-full w-full touch-none";
    input.container.replaceChildren(this.renderer.domElement);
    this.resizeObserver = new ResizeObserver(() => this.resize(input.container));
    this.resizeObserver.observe(input.container);
    this.resize(input.container);
  }

  public static async create(
    input: MountProceduralCharacterBenchmarkRendererInput,
  ): Promise<ProceduralCharacterBenchmarkRuntime> {
    const { rendererRuntime, unitRuntime } = await initializeProceduralCharacterRendererRuntime({
      pixelRatioCap: input.config.pixelRatio,
      preloadPhysics: true,
    });
    let benchmark: ProceduralCharacterBenchmarkRuntime | undefined;
    let worldGymEnvironment: ProceduralWorldGymEnvironment | undefined;
    try {
      if (input.environment === "procedural-biomes") {
        configureGltfTextureSupport(rendererRuntime.renderer as Parameters<typeof configureGltfTextureSupport>[0]);
        worldGymEnvironment = await ProceduralWorldGymEnvironment.create();
      }
      benchmark = new ProceduralCharacterBenchmarkRuntime(input, rendererRuntime, unitRuntime, worldGymEnvironment);
      await benchmark.rebuildPopulation();
      benchmark.startAnimationLoop();
      return benchmark;
    } catch (error) {
      if (benchmark) {
        benchmark.dispose();
      } else {
        worldGymEnvironment?.dispose();
        unitRuntime.dispose();
        rendererRuntime.backend.dispose?.();
      }
      throw error;
    }
  }

  public createHandle(): ProceduralCharacterBenchmarkRendererHandle {
    return {
      dispose: () => this.dispose(),
      killBurst: (count) => this.killBurst(count),
      reset: () => this.reset(),
      resetCamera: () => this.resetCamera(),
      setPaused: (paused) => this.setPaused(paused),
      startPerformanceEvaluation: () => this.startPerformanceEvaluation(),
      stepOnce: () => this.stepOnce(),
      updateConfig: (config) => this.updateConfig(config),
    };
  }

  private startAnimationLoop(): void {
    this.lastFrameTime = performance.now();
    this.renderer.setAnimationLoop((time) => this.update(time));
  }

  private update(time: number): void {
    if (this.disposed) return;
    const frameWorkStart = performance.now();
    const rawDeltaSeconds = Math.max(0, (time - this.lastFrameTime) / 1000);
    const deltaSeconds = Math.min(rawDeltaSeconds, 0.1);
    this.lastFrameTime = time;

    const animationStart = performance.now();
    if (!this.paused && !this.loadingActors) this.advanceSimulation(deltaSeconds);
    if (!this.paused) this.worldGymEnvironment?.update(deltaSeconds);
    const animationCpuMs = performance.now() - animationStart;
    this.controls.update(deltaSeconds);
    const renderStart = performance.now();
    this.gpuTimer.readAvailable().forEach((frameMs) => this.performanceEvaluator.recordGpuFrame(frameMs));
    if (!this.paused && !this.loadingActors) this.gpuTimer.begin();
    this.renderFrame();
    this.gpuTimer.end();
    const renderCpuMs = performance.now() - renderStart;
    if (!this.paused && !this.loadingActors) {
      this.performanceEvaluator.recordFrame({
        animationCpuMs,
        collisionCpuMs: this.collisionCpuMs,
        frameMs: rawDeltaSeconds * 1_000,
        renderCpuMs,
        totalCpuMs: performance.now() - frameWorkStart,
      });
    }
    this.publishStats(time);
    this.renderer.info.reset();
  }

  private advanceSimulation(deltaSeconds: number): void {
    this.simulationAccumulator += deltaSeconds;
    this.simulationSteps = 0;
    while (this.simulationAccumulator >= BENCHMARK_FIXED_STEP_SECONDS && this.simulationSteps < MAX_SIMULATION_STEPS) {
      const events = advanceProceduralCharacterBenchmarkSimulation(
        this.simulation,
        this.config,
        BENCHMARK_FIXED_STEP_SECONDS,
      );
      this.applySimulationEvents(events);
      this.simulationAccumulator -= BENCHMARK_FIXED_STEP_SECONDS;
      this.simulationSteps += 1;
    }
    if (this.simulationSteps === MAX_SIMULATION_STEPS) this.simulationAccumulator = 0;
    this.updateActorPresentation(deltaSeconds * this.config.simulationSpeed);
  }

  private updateActorPresentation(deltaSeconds: number): void {
    this.prepareActorPresentation();
    this.resolveActorCollisions(deltaSeconds);
    this.applyActorTransforms();
    this.unitRuntime.update(deltaSeconds);
    this.scheduleArcherVolleys(deltaSeconds);
    this.scheduleMeleeAttacks(deltaSeconds);
    this.projectiles.update(deltaSeconds);
    this.meleeImpacts.update(deltaSeconds);
  }

  private prepareActorPresentation(): void {
    this.collisionInputs.length = 0;
    this.simulation.agents.forEach((agent) => {
      const record = this.actors.get(agent.id);
      if (!record) return;
      writeBenchmarkAgentPosition(agent, this.positionScratch);
      if (agent.phase !== "running") {
        record.actor.setRangedTarget(undefined);
        record.actor.setMeleeTarget(undefined);
        record.contactActive = false;
        return;
      }
      if (record.actor.kind === "archer") {
        writeBenchmarkArcherTarget(agent.id, this.targetScratch);
        record.actor.setRangedTarget(this.targetScratch);
        record.actor.setMeleeTarget(undefined);
        orientActorTowardTarget(record.actor, this.positionScratch, this.targetScratch);
      } else if (isMeleeKind(record.actor.kind)) {
        writeBenchmarkMeleeTarget(agent, this.targetScratch);
        record.actor.setMeleeTarget(this.targetScratch);
        record.actor.setRangedTarget(undefined);
        orientActorTowardTarget(record.actor, this.positionScratch, this.targetScratch);
      } else {
        record.actor.setRangedTarget(undefined);
        record.actor.setMeleeTarget(undefined);
        orientActorAlongRoute(record.actor, agent);
      }
      record.collisionInput.anchorX = this.positionScratch.x;
      record.collisionInput.anchorZ = this.positionScratch.z;
      record.collisionInput.yaw = record.actor.object.rotation.y;
      if (this.config.collisions) this.collisionInputs.push(record.collisionInput);
    });
  }

  private resolveActorCollisions(deltaSeconds: number): void {
    if (!this.config.collisions) {
      this.collisionCpuMs = 0;
      return;
    }
    const startedAt = performance.now();
    this.separation.update(this.collisionInputs, deltaSeconds);
    this.maximumCollisionDroppedPairCount = Math.max(
      this.maximumCollisionDroppedPairCount,
      this.separation.getStats().droppedPairCount,
    );
    this.collisionCpuMs = performance.now() - startedAt;
  }

  private applyActorTransforms(): void {
    this.simulation.agents.forEach((agent) => {
      const record = this.actors.get(agent.id);
      if (!record) return;
      writeBenchmarkAgentPosition(agent, this.positionScratch);
      const collision =
        this.config.collisions && agent.phase === "running" ? this.separation.getBodySnapshot(agent.id) : undefined;
      const positionX = collision?.positionX ?? this.positionScratch.x;
      const positionZ = collision?.positionZ ?? this.positionScratch.z;
      record.actor.object.position.set(positionX, this.resolveActorGroundY(positionX, positionZ), positionZ);
      const inContact = Boolean(collision?.contactCount);
      if (inContact && !record.contactActive && collision) {
        record.actor.applyReaction({
          directionX: collision.reactionX,
          directionY: 0,
          directionZ: collision.reactionZ,
          source: "body-contact",
          strength: collision.reactionStrength,
        });
      }
      record.contactActive = inContact;
    });
  }

  private resolveActorGroundY(worldX: number, worldZ: number): number {
    if (!this.worldGymEnvironment) return ACTOR_GROUND_Y;
    const surface = this.worldGymEnvironment.sampleWorldSurface(worldX, worldZ);
    return surface.biome === null ? ACTOR_GROUND_Y : surface.height + ACTOR_GROUND_Y;
  }

  private applySimulationEvents(events: readonly ProceduralCharacterBenchmarkEvent[]): void {
    events.forEach((event) => {
      const record = this.actors.get(event.agentId);
      if (!record) return;
      if (event.type === "respawn") {
        record.physicsGeneration += 1;
        record.actor.reset();
        return;
      }
      const generation = record.physicsGeneration;
      void record.actor.applyImpulse().catch((error) => {
        if (this.disposed || generation !== record.physicsGeneration) return;
        this.physicsFailures = [...this.physicsFailures.slice(-2), resolveErrorMessage(error)];
      });
    });
  }

  private killBurst(count = 8): void {
    if (this.disposed || this.loadingActors) return;
    this.applySimulationEvents(killProceduralCharacterBenchmarkAgents(this.simulation, this.config, count));
  }

  private reset(): void {
    if (this.disposed) return;
    this.simulation = createProceduralCharacterBenchmarkSimulation(this.config);
    this.simulationAccumulator = 0;
    this.simulationSteps = 0;
    this.separation.reset();
    this.collisionCpuMs = 0;
    this.maximumCollisionDroppedPairCount = 0;
    this.archerVolleyAccumulator = 0;
    this.archerVolleyCursor = 0;
    this.meleeAttackAccumulator = 0;
    this.meleeAttackCursor = 0;
    this.resetCount += 1;
    this.physicsFailures = [];
    this.actors.forEach((record) => {
      record.physicsGeneration += 1;
      record.actor.reset();
    });
    this.updateActorPresentation(0);
    this.projectiles.reset();
    this.meleeImpacts.reset();
    this.publishStats(performance.now(), true);
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.lastFrameTime = performance.now();
  }

  private stepOnce(): void {
    if (!this.paused || this.loadingActors) return;
    const events = advanceProceduralCharacterBenchmarkSimulation(
      this.simulation,
      this.config,
      BENCHMARK_FIXED_STEP_SECONDS,
    );
    this.applySimulationEvents(events);
    this.updateActorPresentation(BENCHMARK_FIXED_STEP_SECONDS * this.config.simulationSpeed);
    this.simulationSteps = 1;
  }

  private async updateConfig(config: ProceduralCharacterBenchmarkConfig): Promise<void> {
    if (this.disposed) return;
    const normalized = applyProceduralCharacterBenchmarkConfigPatch(this.config, config);
    const collisionModelChanged =
      normalized.characterScale !== this.config.characterScale || normalized.collisions !== this.config.collisions;
    const rebuildPopulation =
      normalized.actorCount !== this.config.actorCount ||
      normalized.seed !== this.config.seed ||
      normalized.unitMix !== this.config.unitMix;
    this.config = normalized;
    if (collisionModelChanged) this.separation.reset();
    if (!normalized.archerVolleys) this.projectiles.reset();
    if (!normalized.meleeAttacks) this.meleeImpacts.reset();
    this.controls.autoRotate = normalized.autoRotate;
    this.unitRuntime.setCrowdAnimationLaneCount(normalized.animationUpdateLanes);
    this.applyRenderVisuals();

    if (rebuildPopulation) {
      await this.rebuildPopulation();
      return;
    }
    this.actors.forEach((record, id) => {
      const { actor } = record;
      actor.object.scale.setScalar(normalized.characterScale);
      this.unitRuntime.updateActorConfig(actor, resolveBenchmarkActorConfig(normalized, id));
      record.collisionInput.profile = createProceduralCollisionProfile(actor.kind, normalized.characterScale);
      record.contactActive = false;
    });
    this.resetPerformanceEvaluation();
  }

  private async rebuildPopulation(): Promise<void> {
    const generation = ++this.populationGeneration;
    this.loadingActors = true;
    this.simulation = createProceduralCharacterBenchmarkSimulation(this.config);
    this.simulationAccumulator = 0;
    this.separation.reset();
    this.collisionCpuMs = 0;
    this.maximumCollisionDroppedPairCount = 0;
    this.maximumLoadingMountHoofReach = 0;
    this.physicsFailures = [];
    this.projectiles.reset();
    this.meleeImpacts.reset();
    this.archerVolleyAccumulator = 0;
    this.archerVolleyCursor = 0;
    this.meleeAttackAccumulator = 0;
    this.meleeAttackCursor = 0;
    this.actors.forEach((record) => {
      record.physicsGeneration += 1;
      record.unsubscribeMeleeContact();
      record.actor.dispose();
    });
    this.actors.clear();

    for (const agent of this.simulation.agents) {
      if (this.disposed || generation !== this.populationGeneration) return;
      this.addActor(agent);
      if (this.actors.size % ACTOR_BUILD_BATCH_SIZE === 0) {
        this.updateActorPresentation(0);
        this.renderFrame();
        this.publishStats(performance.now(), true);
        this.renderer.info.reset();
        await nextAnimationFrame();
      }
    }

    if (this.disposed || generation !== this.populationGeneration) return;
    this.loadingActors = false;
    this.updateActorPresentation(0);
    this.resetPerformanceEvaluation();
    this.publishStats(performance.now(), true);
  }

  private scheduleArcherVolleys(deltaSeconds: number): void {
    if (!this.config.archerVolleys) {
      this.archerVolleyAccumulator = 0;
      return;
    }
    this.archerVolleyAccumulator += Math.max(0, deltaSeconds) * BENCHMARK_ARCHER_VOLLEYS_PER_SECOND;
    while (this.archerVolleyAccumulator >= 1) {
      const agent = this.findNextRunningArcher();
      if (!agent) {
        this.archerVolleyAccumulator = 0;
        return;
      }
      this.spawnArcherVolley(agent);
      this.archerVolleyAccumulator -= 1;
    }
    this.archerVolleyAccumulator = Math.min(this.archerVolleyAccumulator, 2);
  }

  private findNextRunningArcher(): BenchmarkAgentSimulationState | undefined {
    for (let offset = 0; offset < this.simulation.agents.length; offset += 1) {
      const index = (this.archerVolleyCursor + offset) % this.simulation.agents.length;
      const agent = this.simulation.agents[index];
      const actor = this.actors.get(agent.id)?.actor;
      if (agent.phase !== "running" || actor?.kind !== "archer") continue;
      this.archerVolleyCursor = (index + 1) % this.simulation.agents.length;
      return agent;
    }
    return undefined;
  }

  private spawnArcherVolley(agent: BenchmarkAgentSimulationState): void {
    const actor = this.actors.get(agent.id)?.actor;
    if (!actor) return;
    this.positionScratch.copy(actor.object.position);
    this.positionScratch.y += 0.7 * this.config.characterScale;
    writeBenchmarkArcherTarget(agent.id, this.targetScratch);
    this.projectiles.spawnVolley({
      color: CHARACTER_PALETTE[agent.id % CHARACTER_PALETTE.length],
      count: 2,
      flightSeconds: 0.55 + this.positionScratch.distanceTo(this.targetScratch) * 0.025,
      origin: this.positionScratch,
      seed: resolveActorSeed(this.config.seed + Math.floor(this.simulation.elapsedSeconds * 1_000), agent.id),
      spreadDegrees: 0.8,
      target: this.targetScratch,
      targetRadius: 0.42,
    });
  }

  private scheduleMeleeAttacks(deltaSeconds: number): void {
    if (!this.config.meleeAttacks) {
      this.meleeAttackAccumulator = 0;
      return;
    }
    this.meleeAttackAccumulator += Math.max(0, deltaSeconds) * BENCHMARK_MELEE_ATTACKS_PER_SECOND;
    while (this.meleeAttackAccumulator >= 1) {
      const agent = this.findNextRunningMeleeUnit();
      if (!agent) {
        this.meleeAttackAccumulator = 0;
        return;
      }
      const actor = this.actors.get(agent.id)?.actor;
      if (actor) {
        writeBenchmarkMeleeTarget(agent, this.targetScratch);
        actor.fireMeleeAttack(this.targetScratch);
      }
      this.meleeAttackAccumulator -= 1;
    }
    this.meleeAttackAccumulator = Math.min(this.meleeAttackAccumulator, 2);
  }

  private findNextRunningMeleeUnit(): BenchmarkAgentSimulationState | undefined {
    for (let offset = 0; offset < this.simulation.agents.length; offset += 1) {
      const index = (this.meleeAttackCursor + offset) % this.simulation.agents.length;
      const agent = this.simulation.agents[index];
      const actor = this.actors.get(agent.id)?.actor;
      if (agent.phase !== "running" || !actor || !isMeleeKind(actor.kind)) continue;
      this.meleeAttackCursor = (index + 1) % this.simulation.agents.length;
      return agent;
    }
    return undefined;
  }

  private addActor(agent: BenchmarkAgentSimulationState): void {
    const actor = this.unitRuntime.createActor(resolveBenchmarkActorConfig(this.config, agent.id));
    actor.object.name = `benchmark-character:${agent.id}`;
    actor.object.scale.setScalar(this.config.characterScale);
    const worldGymEnvironment = this.worldGymEnvironment;
    if (worldGymEnvironment) {
      actor.setGroundSampler((x, z) => worldGymEnvironment.sampleActorGround(actor.object, x, z, ACTOR_GROUND_Y));
    }
    this.stage.add(actor.object);
    const unsubscribeMeleeContact = actor.onMeleeContact((event) => {
      this.meleeImpacts.spawn({
        direction: event.direction,
        target: event.target,
        tier: resolveActorTroopTier(agent.id),
      });
    });
    this.actors.set(agent.id, {
      actor,
      collisionInput: {
        anchorX: 0,
        anchorZ: 0,
        entityId: agent.id,
        profile: createProceduralCollisionProfile(actor.kind, this.config.characterScale),
        yaw: 0,
      },
      contactActive: false,
      physicsGeneration: 0,
      unsubscribeMeleeContact,
    });
  }

  private renderFrame(): void {
    this.backend.renderFrame?.({
      mainCamera: this.camera,
      mainScene: this.scene,
      sceneName:
        this.environmentMode === "procedural-biomes" ? "procedural-world-gym" : "procedural-character-benchmark",
    });
  }

  private publishStats(time: number, force = false): void {
    if (!this.onStats || (!force && time - this.lastStatsTime < STATS_INTERVAL_MS)) return;
    this.lastStatsTime = time;
    const simulation = resolveProceduralCharacterBenchmarkSimulationSnapshot(this.simulation);
    const physics = this.resolvePhysicsStats();
    const projectiles = this.projectiles.getStats();
    const melee = this.meleeImpacts.getStats();
    const performanceEvaluation = this.performanceEvaluator.getSnapshot();
    const collision = this.separation.getStats();
    const render = this.renderer.info.render;
    const crowdAnimation = this.unitRuntime.getCrowdAnimationStats();
    const mountBoneStretch = this.resolveMountBoneStretch();
    const terrain = this.worldGymEnvironment?.getStats();
    const terrainGrounding = this.resolveTerrainGrounding();
    if (this.loadingActors) {
      this.maximumLoadingMountHoofReach = Math.max(
        this.maximumLoadingMountHoofReach,
        this.resolveMaximumMountHoofReach(),
      );
    }
    this.onStats({
      actorCount: this.actors.size,
      animationUpdateLaneCount: crowdAnimation.laneCount,
      averageFrameMs: performanceEvaluation.frameMs.average,
      collisionBodyCount: collision.bodyCount,
      collisionCandidatePairCount: collision.candidatePairCount,
      collisionDroppedPairCount: this.maximumCollisionDroppedPairCount,
      collisionMaximumOffset: Number(collision.maximumOffset.toFixed(3)),
      collisionResolvedPairCount: collision.resolvedPairCount,
      drawCalls: render.drawCalls ?? render.calls,
      environmentMode: this.environmentMode,
      fps: Math.round(performanceEvaluation.observedFps),
      geometryCount: this.renderer.info.memory.geometries,
      hexCount: BENCHMARK_HEX_CELLS.length,
      loadingActors: this.loadingActors,
      meleeActiveImpactCount: melee.activeCount,
      meleeContactCount: melee.spawnedCount,
      meleeDroppedCount: melee.droppedCount,
      maximumAnimatedMountBoneStretchRatio: mountBoneStretch.animated,
      maximumLoadingMountHoofReach: this.maximumLoadingMountHoofReach,
      maximumRagdollMountBoneStretchRatio: mountBoneStretch.ragdoll,
      p95FrameMs: performanceEvaluation.frameMs.p95,
      performance: performanceEvaluation,
      physicsBodyCount: physics.bodyCount,
      physicsConstraintCount: physics.constraintCount,
      physicsFailures: this.physicsFailures,
      pixelRatio: this.config.pixelRatio,
      projectileActiveCount: projectiles.activeCount,
      projectileDroppedCount: projectiles.droppedCount,
      projectileHitCount: projectiles.hitCount,
      projectileStuckCount: projectiles.stuckCount,
      ragdollCount: simulation.ragdollCount,
      rendererMode: getRendererDiagnosticActiveMode() ?? "initializing",
      resetCount: this.resetCount,
      respawnCount: simulation.totalRespawns,
      runningCount: simulation.runningCount,
      simulationElapsedSeconds: Number(simulation.elapsedSeconds.toFixed(2)),
      simulationSteps: this.simulationSteps,
      textureCount: this.renderer.info.memory.textures,
      terrainBiomeCount: terrain?.biomeCount ?? 0,
      terrainCellCount: terrain?.cellCount ?? 0,
      terrainGroundedActorCount: terrainGrounding.groundedActorCount,
      terrainMaximumRootError: terrainGrounding.maximumRootError,
      terrainPropCount: terrain?.propInstances ?? 0,
      terrainSurfaceMissCount: terrainGrounding.surfaceMissCount,
      terrainTriangles: terrain?.triangles ?? 0,
      totalDeaths: simulation.totalDeaths,
      triangles: render.triangles,
      visibleHexCount: resolveVisibleHexCount(this.camera),
      wasmHeapMiB: Number((physics.wasmHeapBytes / 1024 / 1024).toFixed(2)),
    });
  }

  private resolveMountBoneStretch(): {
    animated: number;
    ragdoll: number;
  } {
    if (this.config.unitMix === "foot" || this.config.unitMix === "archers" || this.config.unitMix === "melee") {
      return { animated: 1, ragdoll: 1 };
    }
    let animated = 1;
    let ragdoll = 1;
    this.actors.forEach(({ actor }) => {
      if (actor.kind !== "horse" && actor.kind !== "paladin") return;
      const stretch = actor.getStats().maximumHorseBoneStretchRatio;
      if (actor.mode === "ragdoll") ragdoll = Math.max(ragdoll, stretch);
      else animated = Math.max(animated, stretch);
    });
    return { animated, ragdoll };
  }

  private resolveMaximumMountHoofReach(): number {
    let maximum = 0;
    this.actors.forEach(({ actor }) => {
      if (actor.kind !== "horse" && actor.kind !== "paladin") return;
      const horse = actor.getPoseDiagnostics().horse;
      if (!horse) return;
      this.positionScratch.fromArray(horse.saddleWorld);
      Object.values(horse.legs).forEach(({ hoofWorld }) => {
        this.targetScratch.fromArray(hoofWorld);
        maximum = Math.max(maximum, this.positionScratch.distanceTo(this.targetScratch) / this.config.characterScale);
      });
    });
    return Number(maximum.toFixed(3));
  }

  private resolveTerrainGrounding(): {
    groundedActorCount: number;
    maximumRootError: number;
    surfaceMissCount: number;
  } {
    const environment = this.worldGymEnvironment;
    if (!environment) return { groundedActorCount: 0, maximumRootError: 0, surfaceMissCount: 0 };
    let groundedActorCount = 0;
    let maximumRootError = 0;
    let surfaceMissCount = 0;
    this.simulation.agents.forEach((agent) => {
      if (agent.phase !== "running") return;
      const actor = this.actors.get(agent.id)?.actor;
      if (!actor) return;
      const surface = environment.sampleWorldSurface(actor.object.position.x, actor.object.position.z);
      if (surface.biome === null) {
        surfaceMissCount += 1;
        return;
      }
      const rootError = Math.abs(actor.object.position.y - (surface.height + ACTOR_GROUND_Y));
      maximumRootError = Math.max(maximumRootError, rootError);
      if (rootError <= 0.025) groundedActorCount += 1;
    });
    return {
      groundedActorCount,
      maximumRootError: Number(maximumRootError.toFixed(3)),
      surfaceMissCount,
    };
  }

  private resolvePhysicsStats(): { bodyCount: number; constraintCount: number; wasmHeapBytes: number } {
    let bodyCount = 0;
    let constraintCount = 0;
    let wasmHeapBytes = 0;
    this.simulation.agents.forEach((agent) => {
      if (agent.phase !== "ragdoll") return;
      const actorStats = this.actors.get(agent.id)?.actor.getStats();
      if (!actorStats) return;
      bodyCount += actorStats.bodyCount;
      constraintCount += actorStats.constraintCount;
      wasmHeapBytes = Math.max(wasmHeapBytes, actorStats.wasmHeapBytes);
    });
    return { bodyCount, constraintCount, wasmHeapBytes };
  }

  private startPerformanceEvaluation(): Promise<void> {
    if (this.performanceEvaluationPromise) return this.performanceEvaluationPromise;
    this.performanceEvaluationPromise = this.calibrateDisplayRefresh()
      .then((fps) => this.performanceEvaluator.setDisplayRefreshFps(fps))
      .finally(() => {
        this.resetPerformanceEvaluation();
        this.performanceEvaluationPromise = undefined;
      });
    return this.performanceEvaluationPromise;
  }

  private async calibrateDisplayRefresh(): Promise<number> {
    const wasPaused = this.paused;
    const wasStageVisible = this.stage.visible;
    this.paused = true;
    this.stage.visible = false;
    try {
      const intervals = await sampleAnimationFrameIntervals(60);
      const average = intervals.reduce((sum, interval) => sum + interval, 0) / Math.max(1, intervals.length);
      return average > 0 ? 1_000 / average : 0;
    } finally {
      this.stage.visible = wasStageVisible;
      this.paused = wasPaused;
      this.lastFrameTime = performance.now();
    }
  }

  private resetPerformanceEvaluation(): void {
    this.gpuTimer.reset();
    this.performanceEvaluator.reset();
    this.maximumCollisionDroppedPairCount = 0;
  }

  private resetCamera(): void {
    this.camera.position.set(14, 20, 18);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0.5, 0);
    this.controls.update();
  }

  private resize(container: HTMLElement): void {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.viewportWidth = width;
    this.viewportHeight = height;
    const aspect = width / height;
    const requiredWidth = this.worldGymEnvironment ? 28 : 23;
    const requiredHeight = 24;
    const viewHeight = Math.max(requiredHeight, requiredWidth / aspect);
    this.camera.left = (-viewHeight * aspect) / 2;
    this.camera.right = (viewHeight * aspect) / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.applyRenderVisuals(width, height);
  }

  private applyRenderVisuals(width = this.viewportWidth, height = this.viewportHeight): void {
    this.backend.applyRenderVisuals?.({
      height: Math.max(1, height),
      pixelRatio: Math.min(window.devicePixelRatio || 1, this.config.pixelRatio),
      shadows: this.config.shadows,
      width: Math.max(1, width),
    });
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.populationGeneration += 1;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.actors.forEach(({ unsubscribeMeleeContact }) => unsubscribeMeleeContact());
    this.unitRuntime.dispose();
    this.actors.clear();
    this.projectiles.dispose();
    this.meleeImpacts.dispose();
    this.gpuTimer.dispose();
    this.worldGymEnvironment?.dispose();
    disposeBenchmarkStage(this.stage);
    this.backend.dispose?.();
    this.renderer.domElement.remove();
  }
}

function createBenchmarkScene(stage: Group, worldGymEnvironment?: ProceduralWorldGymEnvironment): Scene {
  const scene = new Scene();
  const background = worldGymEnvironment ? 0xaab9b2 : 0x070b12;
  scene.background = new Color(background);
  scene.fog = new Fog(background, worldGymEnvironment ? 36 : 32, worldGymEnvironment ? 68 : 58);
  scene.add(stage);

  const hemisphere = new HemisphereLight(0xbdd8ff, 0x17121c, 2.1);
  const key = new DirectionalLight(0xffedcf, 3.2);
  key.position.set(10, 18, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 14;
  key.shadow.camera.bottom = -14;
  scene.add(hemisphere, key);
  stage.add(worldGymEnvironment?.object3d ?? createHexArena());
  return scene;
}

function createHexArena(): InstancedMesh {
  const geometry = new CylinderGeometry(HEX_RADIUS * 0.94, HEX_RADIUS * 0.94, 0.12, 6);
  geometry.rotateY(Math.PI / 6);
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.1,
    roughness: 0.88,
    vertexColors: true,
  });
  const mesh = new InstancedMesh(geometry, material, BENCHMARK_HEX_CELLS.length);
  const matrix = new Matrix4();
  const color = new Color();
  BENCHMARK_HEX_CELLS.forEach((cell) => {
    matrix.makeTranslation(cell.x, 0, cell.z);
    mesh.setMatrixAt(cell.index, matrix);
    color.set((cell.column + cell.row) % 2 === 0 ? 0x172235 : 0x1c2940);
    if ((cell.column + cell.row) % 5 === 0) color.lerp(new Color(0x40305f), 0.28);
    mesh.setColorAt(cell.index, color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.name = "procedural-character-benchmark-hexes";
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function createBenchmarkCamera(): OrthographicCamera {
  const camera = new OrthographicCamera(-16, 16, 12, -12, 0.1, 90);
  camera.position.set(14, 20, 18);
  camera.lookAt(0, 0.5, 0);
  return camera;
}

function createBenchmarkControls(camera: OrthographicCamera, element: HTMLCanvasElement): OrbitControls {
  const controls = new OrbitControls(camera, element);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.target.set(0, 0.5, 0);
  controls.minZoom = 0.65;
  controls.maxZoom = 2.4;
  controls.autoRotateSpeed = 0.35;
  controls.update();
  return controls;
}

function resolveBenchmarkActorConfig(
  benchmark: ProceduralCharacterBenchmarkConfig,
  actorId: number,
): ProceduralUnitConfig {
  const angle = actorId * 2.399963229728653;
  const kind = resolveBenchmarkUnitKind(benchmark.unitMix, actorId);
  const tier = resolveActorTier(actorId);
  const primaryColor = CHARACTER_PALETTE[actorId % CHARACTER_PALETTE.length];
  const humanoid = applyProceduralCharacterConfigPatch(createDefaultProceduralUnitConfig().humanoid, {
    appearanceId: benchmark.appearanceId,
    animationMode: kind === "paladin" ? "mounted" : benchmark.locomotionMode,
    animationSpeed: benchmark.animationSpeed,
    autoRotate: false,
    impulseX: Math.cos(angle) * 6,
    impulseY: 3.2,
    impulseZ: Math.sin(angle) * 6,
    primaryColor,
    renderDetail: "crowd",
    seed: resolveActorSeed(benchmark.seed, actorId),
    showJoints: false,
    stepHeight: benchmark.stepHeight,
    stride: benchmark.stride,
    tier,
    wireframe: false,
  });
  return applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
    archer: {
      aimSeconds: 0.18,
      autoFire: false,
      detailedEquipment: false,
      drawSeconds: 0.38,
      followThroughSeconds: 0.22,
      recoverSeconds: 0.24,
      targetRadius: 0.42,
    },
    kind,
    dragon: {
      altitude: 1.9,
      autoFire: false,
      locomotionMode: "flight",
      primaryColor,
      renderDetail: "crowd",
      seed: resolveActorSeed(benchmark.seed, actorId),
      showBones: false,
      showSockets: false,
      speed: benchmark.movementSpeed * 2.1,
      tier,
      wireframe: false,
    },
    horse: {
      gait: resolveBenchmarkHorseGait(benchmark),
      primaryColor,
      showBones: false,
      showHoofTargets: false,
      showSockets: false,
      speed: benchmark.movementSpeed * 1.8,
      stepHeight: benchmark.stepHeight,
      strideScale: benchmark.stride,
      tier,
    },
    humanoid,
    melee: {
      autoAttack: false,
      detailedEquipment: false,
      offhandId: actorId % 3 === 0 ? "none" : "round-shield",
      weaponId: actorId % 2 === 0 ? "iron-longsword" : "runic-warhammer",
    },
  });
}

function resolveBenchmarkUnitKind(
  mix: ProceduralCharacterBenchmarkConfig["unitMix"],
  actorId: number,
): ProceduralUnitKind {
  if (mix === "archers") return "archer";
  if (mix === "foot") return (["knight", "archer", "crossbowman"] as const)[actorId % 3];
  if (mix === "melee") return actorId % 3 === 0 ? "paladin" : "knight";
  if (mix === "horses") return "horse";
  if (mix === "mounted") return "paladin";
  if (mix === "dragons") return "dragon";
  return (["knight", "archer", "crossbowman", "paladin", "dragon"] as const)[actorId % 5];
}

function resolveBenchmarkHorseGait(
  benchmark: ProceduralCharacterBenchmarkConfig,
): ProceduralUnitConfig["horse"]["gait"] {
  if (benchmark.locomotionMode === "walk") return "walk";
  if (benchmark.movementSpeed > 1.5) return "gallop";
  if (benchmark.movementSpeed > 0.8) return "trot";
  return "walk";
}

function resolveActorTier(actorId: number): 1 | 2 | 3 {
  return ((actorId % 3) + 1) as 1 | 2 | 3;
}

function resolveActorTroopTier(actorId: number): TroopTier {
  const tier = resolveActorTier(actorId);
  if (tier === 3) return TroopTier.T3;
  if (tier === 2) return TroopTier.T2;
  return TroopTier.T1;
}

function resolveActorSeed(seed: number, actorId: number): number {
  return (seed + actorId * 2_654_435_761) % 2_147_483_647;
}

function orientActorAlongRoute(actor: ProceduralUnitActor, agent: BenchmarkAgentSimulationState): void {
  const source = BENCHMARK_HEX_CELLS[agent.currentCellIndex];
  const target = BENCHMARK_HEX_CELLS[agent.targetCellIndex];
  actor.object.rotation.y = Math.atan2(target.x - source.x, target.z - source.z);
}

function writeBenchmarkArcherTarget(actorId: number, out: Vector3): Vector3 {
  const target = BENCHMARK_HEX_CELLS[(actorId * 17 + 43) % BENCHMARK_HEX_CELLS.length];
  return out.set(target.x, 0.68, target.z);
}

function writeBenchmarkMeleeTarget(agent: BenchmarkAgentSimulationState, out: Vector3): Vector3 {
  const source = BENCHMARK_HEX_CELLS[agent.currentCellIndex];
  const target = BENCHMARK_HEX_CELLS[agent.targetCellIndex];
  const distance = Math.hypot(target.x - source.x, target.z - source.z);
  const reachScale = Math.min(0.72, 1.1 / Math.max(distance, 1e-5));
  return out.set(source.x + (target.x - source.x) * reachScale, 0.72, source.z + (target.z - source.z) * reachScale);
}

function isMeleeKind(kind: ProceduralUnitKind): kind is "knight" | "paladin" {
  return kind === "knight" || kind === "paladin";
}

function orientActorTowardTarget(
  actor: ProceduralUnitActor,
  source: Readonly<Vector3>,
  target: Readonly<Vector3>,
): void {
  actor.object.rotation.y = Math.atan2(target.x - source.x, target.z - source.z);
}

function resolveVisibleHexCount(camera: OrthographicCamera): number {
  camera.updateWorldMatrix(true, false);
  const projected = new Vector3();
  return BENCHMARK_HEX_CELLS.reduce((count, cell) => {
    projected.set(cell.x, 0, cell.z).project(camera);
    const visible = Math.abs(projected.x) <= 0.96 && Math.abs(projected.y) <= 0.96 && Math.abs(projected.z) <= 1;
    return count + Number(visible);
  }, 0);
}

function disposeBenchmarkStage(stage: Group): void {
  stage.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (object instanceof InstancedMesh) object.dispose();
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
  stage.clear();
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function sampleAnimationFrameIntervals(sampleCount: number): Promise<number[]> {
  const intervals: number[] = [];
  let previousTime = await nextAnimationFrameTime();
  while (intervals.length < sampleCount) {
    const time = await nextAnimationFrameTime();
    const interval = time - previousTime;
    if (Number.isFinite(interval) && interval > 0 && interval < 1_000) intervals.push(interval);
    previousTime = time;
  }
  return intervals;
}

function nextAnimationFrameTime(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function resolveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Jolt benchmark action failed";
}
