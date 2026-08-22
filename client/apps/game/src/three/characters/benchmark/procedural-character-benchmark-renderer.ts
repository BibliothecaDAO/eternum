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

export interface ProceduralCharacterBenchmarkStats {
  actorCount: number;
  averageFrameMs: number;
  drawCalls: number;
  fps: number;
  geometryCount: number;
  hexCount: number;
  loadingActors: boolean;
  meleeActiveImpactCount: number;
  meleeContactCount: number;
  meleeDroppedCount: number;
  p95FrameMs: number;
  physicsBodyCount: number;
  physicsConstraintCount: number;
  physicsFailures: readonly string[];
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
  stepOnce(): void;
  updateConfig(config: ProceduralCharacterBenchmarkConfig): Promise<void>;
}

interface MountProceduralCharacterBenchmarkRendererInput {
  config: ProceduralCharacterBenchmarkConfig;
  container: HTMLElement;
  onStats?: (stats: ProceduralCharacterBenchmarkStats) => void;
}

interface AnimationLoopRenderer extends RendererSurfaceLike {
  setAnimationLoop(callback: ((time: number) => void) | null): void;
}

interface BenchmarkActorRecord {
  actor: ProceduralUnitActor;
  physicsGeneration: number;
  unsubscribeMeleeContact: () => void;
}

const HEX_RADIUS = 1;
const ACTOR_GROUND_Y = 0.08;
const MAX_SIMULATION_STEPS = 4;
const STATS_INTERVAL_MS = 250;
const FRAME_HISTORY_SIZE = 180;
const ACTOR_BUILD_BATCH_SIZE = 5;
const BENCHMARK_ARROW_CAPACITY = 512;
const BENCHMARK_ARCHER_VOLLEYS_PER_SECOND = 12;
const BENCHMARK_MELEE_ATTACKS_PER_SECOND = 10;
const CHARACTER_PALETTE = ["#4ade80", "#60a5fa", "#f97316", "#c084fc", "#facc15", "#fb7185"] as const;

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
  private readonly stage = new Group();
  private readonly resizeObserver: ResizeObserver;
  private readonly unitRuntime: ProceduralUnitRuntime;
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
  private readonly frameTimes: number[] = [];
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
  private physicsFailures: string[] = [];
  private loadingActors = true;
  private paused = false;
  private disposed = false;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private lastFrameTime = performance.now();
  private lastStatsTime = this.lastFrameTime;

  private constructor(
    input: MountProceduralCharacterBenchmarkRendererInput,
    initialized: Awaited<ReturnType<typeof initializeProceduralCharacterRendererRuntime>>["rendererRuntime"],
    unitRuntime: ProceduralUnitRuntime,
  ) {
    this.config = input.config;
    this.onStats = input.onStats;
    this.backend = initialized.backend;
    this.renderer = initialized.renderer as AnimationLoopRenderer;
    this.unitRuntime = unitRuntime;
    this.simulation = createProceduralCharacterBenchmarkSimulation(this.config);
    this.scene = createBenchmarkScene(this.stage);
    this.stage.add(this.projectiles.group, this.meleeImpacts.group);
    this.camera = createBenchmarkCamera();
    this.controls = createBenchmarkControls(this.camera, this.renderer.domElement);
    this.controls.autoRotate = this.config.autoRotate;
    this.renderer.domElement.id = "procedural-character-benchmark-canvas";
    this.renderer.domElement.setAttribute("aria-label", "One hundred procedural characters on a complete hex map");
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
      pixelRatioCap: 1.5,
      preloadPhysics: true,
    });
    let benchmark: ProceduralCharacterBenchmarkRuntime | undefined;
    try {
      benchmark = new ProceduralCharacterBenchmarkRuntime(input, rendererRuntime, unitRuntime);
      await benchmark.rebuildPopulation();
      benchmark.startAnimationLoop();
      return benchmark;
    } catch (error) {
      if (benchmark) {
        benchmark.dispose();
      } else {
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
    const rawDeltaSeconds = Math.max(0, (time - this.lastFrameTime) / 1000);
    const deltaSeconds = Math.min(rawDeltaSeconds, 0.1);
    this.lastFrameTime = time;
    this.recordFrameTime(rawDeltaSeconds * 1000);

    if (!this.paused && !this.loadingActors) this.advanceSimulation(deltaSeconds);
    this.controls.update(deltaSeconds);
    this.renderFrame();
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
    this.simulation.agents.forEach((agent) => {
      const record = this.actors.get(agent.id);
      if (!record) return;
      writeBenchmarkAgentPosition(agent, this.positionScratch);
      record.actor.object.position.set(this.positionScratch.x, ACTOR_GROUND_Y, this.positionScratch.z);
      if (agent.phase !== "running") {
        record.actor.setRangedTarget(undefined);
        record.actor.setMeleeTarget(undefined);
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
    });
    this.unitRuntime.update(deltaSeconds);
    this.scheduleArcherVolleys(deltaSeconds);
    this.scheduleMeleeAttacks(deltaSeconds);
    this.projectiles.update(deltaSeconds);
    this.meleeImpacts.update(deltaSeconds);
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
    const rebuildPopulation =
      normalized.actorCount !== this.config.actorCount ||
      normalized.seed !== this.config.seed ||
      normalized.unitMix !== this.config.unitMix;
    this.config = normalized;
    if (!normalized.archerVolleys) this.projectiles.reset();
    if (!normalized.meleeAttacks) this.meleeImpacts.reset();
    this.controls.autoRotate = normalized.autoRotate;
    this.applyRenderVisuals();

    if (rebuildPopulation) {
      await this.rebuildPopulation();
      return;
    }
    this.actors.forEach(({ actor }, id) => {
      actor.object.scale.setScalar(normalized.characterScale);
      this.unitRuntime.updateActorConfig(actor, resolveBenchmarkActorConfig(normalized, id));
    });
  }

  private async rebuildPopulation(): Promise<void> {
    const generation = ++this.populationGeneration;
    this.loadingActors = true;
    this.simulation = createProceduralCharacterBenchmarkSimulation(this.config);
    this.simulationAccumulator = 0;
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
    this.stage.add(actor.object);
    const unsubscribeMeleeContact = actor.onMeleeContact((event) => {
      this.meleeImpacts.spawn({
        direction: event.direction,
        target: event.target,
        tier: resolveActorTroopTier(agent.id),
      });
    });
    this.actors.set(agent.id, { actor, physicsGeneration: 0, unsubscribeMeleeContact });
  }

  private renderFrame(): void {
    this.backend.renderFrame?.({
      mainCamera: this.camera,
      mainScene: this.scene,
      sceneName: "procedural-character-benchmark",
    });
  }

  private publishStats(time: number, force = false): void {
    if (!this.onStats || (!force && time - this.lastStatsTime < STATS_INTERVAL_MS)) return;
    this.lastStatsTime = time;
    const simulation = resolveProceduralCharacterBenchmarkSimulationSnapshot(this.simulation);
    const physics = this.resolvePhysicsStats();
    const projectiles = this.projectiles.getStats();
    const melee = this.meleeImpacts.getStats();
    const frame = resolveFrameTimeStats(this.frameTimes);
    const render = this.renderer.info.render;
    this.onStats({
      actorCount: this.actors.size,
      averageFrameMs: frame.average,
      drawCalls: render.drawCalls ?? render.calls,
      fps: frame.average > 0 ? Math.round(1000 / frame.average) : 0,
      geometryCount: this.renderer.info.memory.geometries,
      hexCount: BENCHMARK_HEX_CELLS.length,
      loadingActors: this.loadingActors,
      meleeActiveImpactCount: melee.activeCount,
      meleeContactCount: melee.spawnedCount,
      meleeDroppedCount: melee.droppedCount,
      p95FrameMs: frame.p95,
      physicsBodyCount: physics.bodyCount,
      physicsConstraintCount: physics.constraintCount,
      physicsFailures: this.physicsFailures,
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
      totalDeaths: simulation.totalDeaths,
      triangles: render.triangles,
      visibleHexCount: resolveVisibleHexCount(this.camera),
      wasmHeapMiB: Number((physics.wasmHeapBytes / 1024 / 1024).toFixed(2)),
    });
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

  private recordFrameTime(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 2_000) return;
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > FRAME_HISTORY_SIZE) this.frameTimes.shift();
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
    const requiredWidth = 23;
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
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
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
    disposeBenchmarkStage(this.stage);
    this.backend.dispose?.();
    this.renderer.domElement.remove();
  }
}

function createBenchmarkScene(stage: Group): Scene {
  const scene = new Scene();
  scene.background = new Color(0x070b12);
  scene.fog = new Fog(0x070b12, 32, 58);
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
  stage.add(createHexArena());
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
    animationMode: kind === "paladin" ? "mounted" : "run",
    animationSpeed: benchmark.animationSpeed,
    autoRotate: false,
    impulseX: Math.cos(angle) * 6,
    impulseY: 3.2,
    impulseZ: Math.sin(angle) * 6,
    primaryColor,
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
    horse: {
      gait: benchmark.movementSpeed > 1.5 ? "gallop" : benchmark.movementSpeed > 0.8 ? "trot" : "walk",
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
  return (["knight", "archer", "crossbowman", "paladin"] as const)[actorId % 4];
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

function resolveFrameTimeStats(frameTimes: readonly number[]): { average: number; p95: number } {
  if (frameTimes.length === 0) return { average: 0, p95: 0 };
  const average = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;
  const sorted = frameTimes.toSorted((left, right) => left - right);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return { average: Number(average.toFixed(1)), p95: Number(p95.toFixed(1)) };
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

function resolveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Jolt benchmark action failed";
}
