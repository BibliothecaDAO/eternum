import {
  applyProceduralUnitConfigPatch,
  type ProceduralUnitActor,
  type ProceduralUnitConfig,
  type ProceduralUnitRuntime,
} from "@/three/characters";
import { ArrowProjectileSystem } from "@/three/projectiles/arrow-projectile-system";
import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { getRendererDiagnosticActiveMode } from "@/three/renderer-diagnostics";
import {
  AxesHelper,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SpotLight,
  Vector3,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { initializeProceduralCharacterRendererRuntime } from "../procedural-character-renderer-runtime";
import { sampleProceduralHorseTerrain } from "../horse/procedural-horse-pose";
import { ProceduralArcherGymStage } from "./procedural-archer-gym-stage";
import { ProceduralMeleeGymStage } from "./procedural-melee-gym-stage";
import {
  clampFrameIndex,
  createProceduralAnimationCapturePlan,
  resolveAnimationCapturePhase,
  resolveAnimationFrameIssues,
  type ProceduralAnimationCaptureResult,
  type ProceduralAnimationCaptureOverlay,
  type ProceduralAnimationCaptureSampling,
  type ProceduralAnimationCaptureSequence,
  type ProceduralAnimationCaptureView,
  type ProceduralAnimationFrameCapture,
  type ProceduralAnimationViewCapture,
} from "./procedural-animation-capture";
import { createProceduralAnimationFrameAnnotations } from "./procedural-animation-annotations";
import { renderProceduralAnimationAnnotations } from "./procedural-animation-annotation-renderer";
import {
  advanceCharacterGymSmoke,
  completeCharacterGymSmoke,
  createIdleCharacterGymSmokeState,
  startCharacterGymSmoke,
  type CharacterGymSmokeState,
} from "./procedural-character-smoke";

export interface ProceduralCharacterGymStats {
  activeBodies: number;
  assetLabel: string;
  authoredClipCount: number;
  boneCount: number;
  bodyCount: number;
  constraintCount: number;
  drawCalls: number;
  fps: number;
  frameMs: number;
  geometryCount: number;
  leftPalmInwardDot: number;
  minimumBendAlignment: number;
  meleeContactCount: number;
  meleeOffhandId: string;
  meleeOffhandSource: string;
  meleePhase: string;
  meleeWeaponId: string;
  meleeWeaponSource: string;
  mode: "animated" | "ragdoll";
  physicsSteps: number;
  previewArrowVisible: boolean;
  projectileActiveCount: number;
  projectileCapacity: number;
  projectileDroppedCount: number;
  projectileHitCount: number;
  projectileStuckCount: number;
  rangedPhase: string;
  rangedReleaseCount: number;
  rendererMode: string;
  rightPalmInwardDot: number;
  smokeFailures: readonly string[];
  smokePhase: CharacterGymSmokeState["phase"];
  skinnedMeshCount: number;
  stanceFootCount: number;
  stanceHoofCount: number;
  stringContinuityError: number;
  triangles: number;
  textureCount: number;
  wasmHeapMiB: number;
}

export interface ProceduralCharacterGymRendererHandle {
  applyImpulse(): Promise<void>;
  attackMelee(): boolean;
  captureAnimationFrames(
    sampling: ProceduralAnimationCaptureSampling,
    overlay?: ProceduralAnimationCaptureOverlay,
  ): Promise<ProceduralAnimationCaptureResult>;
  cancelArrow(): void;
  cancelMelee(): void;
  dispose(): void;
  fireArrow(): boolean;
  reset(): void;
  resetCamera(): void;
  runSmoke(): void;
  setPaused(paused: boolean): void;
  seekAnimationFrame(
    frameIndex: number,
    sequence: ProceduralAnimationCaptureSequence,
  ): Promise<ProceduralAnimationFrameCapture>;
  startRagdoll(): Promise<void>;
  stepOnce(): void;
  updateConfig(config: ProceduralUnitConfig): void;
}

interface MountProceduralCharacterGymRendererInput {
  config: ProceduralUnitConfig;
  container: HTMLElement;
  onStats?: (stats: ProceduralCharacterGymStats) => void;
}

interface AnimationLoopRenderer extends RendererSurfaceLike {
  setAnimationLoop(callback: ((time: number) => void) | null): void;
}

const STATS_INTERVAL_MS = 200;

export async function mountProceduralCharacterGymRenderer(
  input: MountProceduralCharacterGymRendererInput,
): Promise<ProceduralCharacterGymRendererHandle> {
  const runtime = await ProceduralCharacterGymRuntime.create(input);
  return runtime.createHandle();
}

class ProceduralCharacterGymRuntime {
  private readonly backend: Awaited<
    ReturnType<typeof initializeProceduralCharacterRendererRuntime>
  >["rendererRuntime"]["backend"];
  private readonly renderer: AnimationLoopRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly inspectionFill = new DirectionalLight(0xe6efff, 0);
  private readonly stage = new Group();
  private readonly resizeObserver: ResizeObserver;
  private readonly onStats?: (stats: ProceduralCharacterGymStats) => void;
  private readonly unitRuntime: ProceduralUnitRuntime;
  private readonly archerStage: ProceduralArcherGymStage;
  private readonly meleeStage: ProceduralMeleeGymStage;
  private projectiles: ArrowProjectileSystem;
  private character: ProceduralUnitActor;
  private config: ProceduralUnitConfig;
  private smoke = createIdleCharacterGymSmokeState();
  private paused = false;
  private disposed = false;
  private lastFrameTime = performance.now();
  private lastStatsTime = this.lastFrameTime;
  private unsubscribeRangedRelease: () => void = () => undefined;
  private unsubscribeMeleeContact: () => void = () => undefined;
  private unsubscribeImpact: () => void = () => undefined;
  private readonly targetPosition = new Vector3();
  private readonly targetVelocity = new Vector3();
  private readonly captureCanvas = document.createElement("canvas");
  private captureGeneration = 0;

  private constructor(
    input: MountProceduralCharacterGymRendererInput,
    initialized: Awaited<ReturnType<typeof initializeProceduralCharacterRendererRuntime>>["rendererRuntime"],
    unitRuntime: ProceduralUnitRuntime,
  ) {
    this.config = input.config;
    this.onStats = input.onStats;
    this.backend = initialized.backend;
    this.renderer = initialized.renderer as AnimationLoopRenderer;
    this.scene = createGymScene(this.stage);
    this.scene.add(this.inspectionFill, this.inspectionFill.target);
    this.camera = createGymCamera();
    this.controls = createGymControls(this.camera, this.renderer.domElement);
    this.unitRuntime = unitRuntime;
    this.character = unitRuntime.createActor(this.config);
    this.stage.add(this.character.object);
    this.archerStage = new ProceduralArcherGymStage(this.config.archer);
    this.meleeStage = new ProceduralMeleeGymStage(this.config.melee);
    this.projectiles = createArrowProjectileSystem(this.config);
    this.stage.add(this.archerStage.group, this.meleeStage.group, this.projectiles.group);
    this.connectCharacterRangedRelease();
    this.connectCharacterMeleeContact();
    this.connectProjectileImpact();
    this.updateActionStageVisibility();
    this.syncActionTargets();
    updateGymTerrain(this.stage, this.config);
    this.controls.autoRotate = this.config.humanoid.autoRotate;
    this.renderer.domElement.id = "procedural-character-gym-canvas";
    this.renderer.domElement.setAttribute("aria-label", "Procedural character animation and ragdoll gym");
    this.renderer.domElement.className = "h-full w-full touch-none";
    input.container.replaceChildren(this.renderer.domElement);
    this.resizeObserver = new ResizeObserver(() => this.resize(input.container));
    this.resizeObserver.observe(input.container);
    this.resize(input.container);
    this.renderer.setAnimationLoop((time) => this.update(time));
  }

  public static async create(input: MountProceduralCharacterGymRendererInput): Promise<ProceduralCharacterGymRuntime> {
    const { rendererRuntime, unitRuntime } = await initializeProceduralCharacterRendererRuntime({
      pixelRatioCap: 2,
      preloadPhysics: true,
    });
    try {
      return new ProceduralCharacterGymRuntime(input, rendererRuntime, unitRuntime);
    } catch (error) {
      unitRuntime.dispose();
      rendererRuntime.backend.dispose?.();
      throw error;
    }
  }

  public createHandle(): ProceduralCharacterGymRendererHandle {
    return {
      applyImpulse: () => this.applyImpulse(),
      attackMelee: () => this.attackMelee(),
      captureAnimationFrames: (sampling, overlay) => this.captureAnimationFrames(sampling, overlay),
      cancelArrow: () => this.character.cancelRangedAttack(),
      cancelMelee: () => this.character.cancelMeleeAttack(),
      dispose: () => this.dispose(),
      fireArrow: () => this.fireArrow(),
      reset: () => this.reset(),
      resetCamera: () => this.resetCamera(),
      runSmoke: () => this.runSmoke(),
      setPaused: (paused) => this.setPaused(paused),
      seekAnimationFrame: (frameIndex, sequence) => this.seekAnimationFrame(frameIndex, sequence),
      startRagdoll: () => this.startRagdoll(),
      stepOnce: () => this.stepOnce(),
      updateConfig: (config) => this.updateConfig(config),
    };
  }

  private update(time: number): void {
    if (this.disposed) return;
    const deltaSeconds = Math.min(Math.max(0, (time - this.lastFrameTime) / 1000), 0.05);
    this.lastFrameTime = time;
    if (!this.paused) this.advance(deltaSeconds);
    this.controls.update(deltaSeconds);
    this.renderFrame();
    this.publishStats(time, deltaSeconds);
    this.renderer.info.reset();
  }

  private advance(deltaSeconds: number): void {
    this.archerStage.update(deltaSeconds);
    this.meleeStage.update(deltaSeconds);
    this.syncActionTargets();
    this.unitRuntime.update(deltaSeconds);
    this.projectiles.update(deltaSeconds);
    this.advanceSmoke(deltaSeconds);
  }

  private advanceSmoke(deltaSeconds: number): void {
    const result = advanceCharacterGymSmoke(this.smoke, deltaSeconds);
    this.smoke = result.state;
    for (const action of result.actions) {
      if (action === "start-ragdoll") this.runSmokePhysicsAction(() => this.startRagdoll());
      if (action === "apply-impulse") this.runSmokePhysicsAction(() => this.applyImpulse());
      if (action === "evaluate") this.evaluateSmoke();
    }
  }

  private runSmokePhysicsAction(action: () => Promise<void>): void {
    void action().catch((error) => {
      this.smoke = completeCharacterGymSmoke(this.smoke, [resolveErrorMessage(error)]);
    });
  }

  private evaluateSmoke(): void {
    const failures: string[] = [];
    const stats = this.character.getStats();
    if (!this.character.hasFiniteState()) failures.push("character pose contains a non-finite value");
    const expectedReferenceClips = this.config.kind === "horse" || this.config.kind === "paladin";
    if (!expectedReferenceClips && stats.authoredClipCount !== 0) failures.push("authored animation clips were loaded");
    if (expectedReferenceClips && stats.authoredClipCount < 13) failures.push("horse reference clips were not loaded");
    if (expectedReferenceClips && stats.minimumBendAlignment < 0) failures.push("a horse leg crossed its bend pole");
    if (stats.mode !== "ragdoll") failures.push("ragdoll did not initialize");
    if (this.config.kind === "archer") {
      const projectiles = this.projectiles.getStats();
      if (stats.rangedReleaseCount < 1) failures.push("archer did not emit a release edge");
      if (projectiles.spawnedCount < 1) failures.push("archer release did not spawn a pooled arrow");
      if (projectiles.hitCount < 1) failures.push("pooled arrow did not sweep-hit the target");
    }
    if (isMeleeKind(this.config.kind) && this.meleeStage.getContactCount() !== 1) {
      failures.push("melee attack did not emit exactly one cosmetic contact edge");
    }
    const expectedPhysics = resolveExpectedPhysicsCounts(this.config.kind);
    const bodyCount = stats.bodyCount;
    if (bodyCount !== expectedPhysics.bodies) {
      failures.push(`expected ${expectedPhysics.bodies} articulated Jolt bodies, received ${bodyCount}`);
    }
    const constraintCount = stats.constraintCount;
    if (constraintCount !== expectedPhysics.constraints) {
      failures.push(`expected ${expectedPhysics.constraints} Jolt constraints, received ${constraintCount}`);
    }
    this.smoke = completeCharacterGymSmoke(this.smoke, failures);
  }

  private async startRagdoll(): Promise<void> {
    if (this.disposed) return;
    await this.character.startRagdoll();
  }

  private async applyImpulse(): Promise<void> {
    if (this.disposed) return;
    await this.character.applyImpulse("chest");
  }

  private fireArrow(): boolean {
    if (this.disposed || this.config.kind !== "archer") return false;
    this.syncActionTargets();
    return this.character.fireRangedAttack(this.targetPosition);
  }

  private attackMelee(): boolean {
    if (this.disposed || !isMeleeKind(this.config.kind)) return false;
    this.syncActionTargets();
    return this.character.fireMeleeAttack(this.targetPosition);
  }

  private async captureAnimationFrames(
    sampling: ProceduralAnimationCaptureSampling,
    overlay?: ProceduralAnimationCaptureOverlay,
  ): Promise<ProceduralAnimationCaptureResult> {
    const plan = createProceduralAnimationCapturePlan(this.config, sampling, undefined, overlay);
    const generation = ++this.captureGeneration;
    this.prepareAnimationCapture(plan.sequence);
    const frames: ProceduralAnimationFrameCapture[] = [];
    let currentFrame = 0;
    for (const sampleFrame of plan.sampleFrames) {
      this.assertCaptureGeneration(generation);
      while (currentFrame < sampleFrame) {
        this.advanceInspectionFrame();
        currentFrame += 1;
      }
      frames.push(await this.captureInspectionFrame(plan, sampleFrame, generation));
    }
    return { config: structuredClone(this.config), frames, plan };
  }

  private async seekAnimationFrame(
    frameIndex: number,
    sequence: ProceduralAnimationCaptureSequence,
  ): Promise<ProceduralAnimationFrameCapture> {
    const plan = createProceduralAnimationCapturePlan(this.config, "key-phases", sequence, "clean");
    const targetFrame = clampFrameIndex(frameIndex, plan.totalFrames);
    const generation = ++this.captureGeneration;
    this.prepareAnimationCapture(sequence);
    for (let currentFrame = 0; currentFrame < targetFrame; currentFrame += 1) {
      this.advanceInspectionFrame();
    }
    return this.captureInspectionFrame(plan, targetFrame, generation);
  }

  private prepareAnimationCapture(sequence: ProceduralAnimationCaptureSequence): void {
    assertCaptureSequenceMatchesKind(sequence, this.config.kind);
    this.setPaused(true);
    this.controls.autoRotate = false;
    this.resetRuntimeState();
    this.inspectionFill.intensity = 2.2;
    this.focusAnimationInspectionCamera();
    this.archerStage.group.visible = false;
    this.meleeStage.group.visible = false;
    this.projectiles.group.visible = false;
    if (sequence === "archer-shot") this.fireArrow();
    if (sequence === "melee-attack") this.attackMelee();
    this.unitRuntime.update(0);
  }

  private advanceInspectionFrame(): void {
    const fixedStep = this.config.humanoid.fixedStep;
    this.archerStage.update(fixedStep);
    this.meleeStage.update(fixedStep);
    this.syncActionTargets();
    this.unitRuntime.stepOnce();
    this.projectiles.stepOnce();
  }

  private async captureInspectionFrame(
    plan: ReturnType<typeof createProceduralAnimationCapturePlan>,
    frameIndex: number,
    generation: number,
  ): Promise<ProceduralAnimationFrameCapture> {
    const diagnostics = this.character.getPoseDiagnostics();
    const expectedPhase = resolveAnimationCapturePhase(plan, frameIndex)?.id ?? "complete";
    const runtimePhase = resolveRuntimeCapturePhase(plan.sequence, this.character);
    const issues = resolveAnimationFrameIssues({ diagnostics, expectedPhase, runtimePhase });
    const views = await this.captureInspectionViews(
      plan,
      frameIndex,
      diagnostics,
      expectedPhase,
      runtimePhase,
      issues,
      generation,
    );
    const primaryView = views[0];
    return {
      diagnostics,
      elapsedSeconds: Number((frameIndex * plan.fixedStepSeconds).toFixed(4)),
      expectedPhase,
      frameIndex,
      imageDataUrl: primaryView?.imageDataUrl ?? null,
      imageNonBlank: views.length > 0 && views.every(({ imageNonBlank }) => imageNonBlank),
      issues,
      runtimePhase,
      views,
    };
  }

  private async captureInspectionViews(
    plan: ReturnType<typeof createProceduralAnimationCapturePlan>,
    frameIndex: number,
    diagnostics: ProceduralAnimationFrameCapture["diagnostics"],
    expectedPhase: string,
    runtimePhase: string,
    issues: readonly string[],
    generation: number,
  ): Promise<ProceduralAnimationViewCapture[]> {
    const views: ProceduralAnimationViewCapture[] = [];
    for (const view of plan.views) {
      this.focusAnimationInspectionCamera(view, diagnostics);
      this.renderFrame();
      await nextBrowserFrame();
      this.assertCaptureGeneration(generation);
      const annotations =
        plan.overlay === "diagnostic"
          ? createProceduralAnimationFrameAnnotations({
              diagnostics,
              elapsedSeconds: frameIndex * plan.fixedStepSeconds,
              expectedPhase,
              frameIndex,
              issues,
              runtimePhase,
              view,
            })
          : undefined;
      const image = captureCanvasThumbnail(this.renderer.domElement, this.captureCanvas, this.camera, annotations);
      views.push({
        id: view.id,
        imageDataUrl: image.dataUrl,
        imageNonBlank: image.nonBlank,
        label: view.label,
      });
    }
    return views;
  }

  private assertCaptureGeneration(generation: number): void {
    if (this.disposed || generation !== this.captureGeneration) {
      throw new Error("Animation capture was superseded by a newer gym action");
    }
  }

  private updateConfig(config: ProceduralUnitConfig): void {
    if (this.disposed) return;
    this.captureGeneration += 1;
    const normalized = applyProceduralUnitConfigPatch(this.config, config);
    const kindChanged = normalized.kind !== this.config.kind;
    const projectileCapacityChanged = normalized.archer.projectileCapacity !== this.config.archer.projectileCapacity;
    this.config = normalized;
    updateGymTerrain(this.stage, normalized);
    this.controls.autoRotate = normalized.humanoid.autoRotate;
    this.archerStage.updateConfig(normalized.archer);
    this.meleeStage.updateConfig(normalized.melee);
    if (projectileCapacityChanged) this.replaceProjectileSystem();
    else this.projectiles.updateConfig(resolveArrowProjectileSystemConfig(normalized));
    this.updateActionStageVisibility();
    if (kindChanged) this.replaceCharacter();
    else this.unitRuntime.updateActorConfig(this.character, normalized);
    this.syncActionTargets();
    if (kindChanged) this.resetCamera();
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) {
      this.inspectionFill.intensity = 0;
      this.controls.autoRotate = this.config.humanoid.autoRotate;
      this.updateActionStageVisibility();
    }
    this.lastFrameTime = performance.now();
  }

  private stepOnce(): void {
    if (!this.paused) return;
    this.captureGeneration += 1;
    this.advanceInspectionFrame();
  }

  private runSmoke(): void {
    this.reset();
    this.smoke = startCharacterGymSmoke();
    if (this.config.kind === "archer") this.fireArrow();
    if (isMeleeKind(this.config.kind)) this.attackMelee();
  }

  private reset(): void {
    this.captureGeneration += 1;
    this.resetRuntimeState();
  }

  private resetRuntimeState(): void {
    this.character.reset();
    this.projectiles.reset();
    this.archerStage.reset();
    this.meleeStage.reset();
    this.syncActionTargets();
    this.smoke = createIdleCharacterGymSmokeState();
  }

  private publishStats(time: number, deltaSeconds: number): void {
    if (!this.onStats || time - this.lastStatsTime < STATS_INTERVAL_MS) return;
    this.lastStatsTime = time;
    const character = this.character.getStats();
    const render = this.renderer.info.render;
    const projectiles = this.projectiles.getStats();
    this.onStats({
      activeBodies: character.activeBodyCount,
      assetLabel: character.assetLabel,
      authoredClipCount: character.authoredClipCount,
      boneCount: character.boneCount,
      bodyCount: character.bodyCount,
      constraintCount: character.constraintCount,
      drawCalls: render.drawCalls ?? render.calls,
      fps: Math.round(1 / Math.max(deltaSeconds, 1 / 240)),
      frameMs: Number((deltaSeconds * 1000).toFixed(1)),
      geometryCount: this.renderer.info.memory.geometries,
      leftPalmInwardDot: Number(character.leftPalmInwardDot.toFixed(3)),
      minimumBendAlignment: Number(character.minimumBendAlignment.toFixed(3)),
      meleeContactCount: this.meleeStage.getContactCount(),
      meleeOffhandId: character.meleeOffhandId,
      meleeOffhandSource: character.meleeOffhandSource,
      meleePhase: character.meleePhase,
      meleeWeaponId: character.meleeWeaponId,
      meleeWeaponSource: character.meleeWeaponSource,
      mode: character.mode,
      physicsSteps: character.physicsSteps,
      previewArrowVisible: character.previewArrowVisible,
      projectileActiveCount: projectiles.activeCount,
      projectileCapacity: projectiles.capacity,
      projectileDroppedCount: projectiles.droppedCount,
      projectileHitCount: projectiles.hitCount,
      projectileStuckCount: projectiles.stuckCount,
      rangedPhase: character.rangedPhase,
      rangedReleaseCount: character.rangedReleaseCount,
      rendererMode: getRendererDiagnosticActiveMode() ?? "initializing",
      rightPalmInwardDot: Number(character.rightPalmInwardDot.toFixed(3)),
      smokeFailures: this.smoke.failures,
      smokePhase: this.smoke.phase,
      skinnedMeshCount: character.skinnedMeshCount,
      stanceFootCount: character.stanceFootCount,
      stanceHoofCount: character.stanceHoofCount,
      stringContinuityError: Number(character.stringContinuityError.toFixed(3)),
      triangles: render.triangles,
      textureCount: this.renderer.info.memory.textures,
      wasmHeapMiB: Number((character.wasmHeapBytes / 1024 / 1024).toFixed(2)),
    });
  }

  private resetCamera(): void {
    if (isMeleeKind(this.config.kind)) {
      this.camera.position.set(4.8, 2.8, 6.4);
      this.controls.target.set(-0.12, 1.08, 0.62);
      this.controls.update();
      return;
    }
    this.camera.position.set(8.4, 4.4, 11.5);
    this.controls.target.set(0, 1.35, 2.35);
    this.controls.update();
  }

  private focusAnimationInspectionCamera(
    view: Pick<ProceduralAnimationCaptureView, "azimuthDegrees" | "elevationDegrees"> &
      Partial<Pick<ProceduralAnimationCaptureView, "detailTarget" | "distanceScale">> = {
      azimuthDegrees: 35,
      elevationDegrees: 12,
    },
    diagnostics?: ProceduralAnimationFrameCapture["diagnostics"],
  ): void {
    const mounted = this.config.kind === "paladin" || this.config.kind === "horse";
    const aspectFitScale = Math.max(1, 1.15 / Math.max(0.5, this.camera.aspect));
    const distanceScale = view.distanceScale ?? 1;
    const distance = (mounted ? 6.3 : 4.7) * (view.detailTarget ? 1 : aspectFitScale) * distanceScale;
    const targetHeight = mounted ? 1.55 : 1.4;
    const detailTarget = view.detailTarget;
    const targetTuple = detailTarget
      ? diagnostics?.humanoid?.socketGrips[detailTarget === "gripLeft" ? "left" : "right"]
      : null;
    const target = targetTuple ? new Vector3(...targetTuple) : new Vector3(0, targetHeight, 0);
    const azimuth = (view.azimuthDegrees * Math.PI) / 180;
    const elevation = (view.elevationDegrees * Math.PI) / 180;
    const horizontalDistance = Math.cos(elevation) * distance;
    this.camera.position.set(
      target.x + Math.sin(azimuth) * horizontalDistance,
      target.y + Math.sin(elevation) * distance,
      target.z + Math.cos(azimuth) * horizontalDistance,
    );
    this.controls.target.copy(target);
    this.inspectionFill.position.copy(this.camera.position);
    this.inspectionFill.target.position.copy(this.controls.target);
    this.controls.update();
  }

  private resize(container: HTMLElement): void {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.backend.applyRenderVisuals?.({
      height,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      shadows: true,
      width,
    });
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.captureGeneration += 1;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.unsubscribeRangedRelease();
    this.unsubscribeMeleeContact();
    this.unsubscribeImpact();
    this.projectiles.dispose();
    this.archerStage.dispose();
    this.meleeStage.dispose();
    this.unitRuntime.dispose();
    disposeStage(this.stage);
    this.backend.dispose?.();
    this.renderer.domElement.remove();
  }

  private replaceCharacter(): void {
    this.unsubscribeRangedRelease();
    this.unsubscribeMeleeContact();
    this.character.dispose();
    this.character = this.unitRuntime.createActor(this.config);
    this.stage.add(this.character.object);
    this.connectCharacterRangedRelease();
    this.connectCharacterMeleeContact();
    this.updateActionStageVisibility();
    this.syncActionTargets();
    this.smoke = createIdleCharacterGymSmokeState();
  }

  private renderFrame(): void {
    this.backend.renderFrame?.({
      mainCamera: this.camera,
      mainScene: this.scene,
      sceneName: "procedural-character-gym",
    });
  }

  private connectCharacterRangedRelease(): void {
    this.unsubscribeRangedRelease = this.character.onRangedRelease((event) => {
      this.archerStage.writeTargetVelocity(this.targetVelocity);
      this.projectiles.spawnVolley({
        color: this.config.humanoid.primaryColor,
        count: this.config.archer.volleyCount,
        flightSeconds: this.config.archer.projectileFlightSeconds,
        origin: event.origin,
        seed: event.seed,
        spreadDegrees: this.config.archer.volleySpreadDegrees,
        target: event.target,
        targetRadius: this.config.archer.targetRadius,
        targetVelocity: this.targetVelocity,
      });
    });
  }

  private connectCharacterMeleeContact(): void {
    this.unsubscribeMeleeContact = this.character.onMeleeContact((event) => this.meleeStage.registerContact(event));
  }

  private connectProjectileImpact(): void {
    this.unsubscribeImpact = this.projectiles.onImpact(({ targetHit }) => this.archerStage.registerImpact(targetHit));
  }

  private replaceProjectileSystem(): void {
    this.unsubscribeImpact();
    this.projectiles.dispose();
    this.projectiles = createArrowProjectileSystem(this.config);
    this.stage.add(this.projectiles.group);
    this.connectProjectileImpact();
  }

  private syncActionTargets(): void {
    if (this.config.kind === "archer") {
      this.archerStage.writeTargetPosition(this.targetPosition);
      this.character.setRangedTarget(this.targetPosition);
      this.character.setMeleeTarget(undefined);
      return;
    }
    if (isMeleeKind(this.config.kind)) {
      this.meleeStage.writeTargetPosition(this.targetPosition);
      this.character.setMeleeTarget(this.targetPosition);
      this.character.setRangedTarget(undefined);
      return;
    }
    this.character.setRangedTarget(undefined);
    this.character.setMeleeTarget(undefined);
  }

  private updateActionStageVisibility(): void {
    const archerVisible = this.config.kind === "archer";
    this.archerStage.group.visible = archerVisible;
    this.projectiles.group.visible = archerVisible;
    this.meleeStage.group.visible = isMeleeKind(this.config.kind);
    if (!archerVisible) this.projectiles.reset();
  }
}

function createArrowProjectileSystem(config: ProceduralUnitConfig): ArrowProjectileSystem {
  return new ArrowProjectileSystem({
    ...resolveArrowProjectileSystemConfig(config),
    capacity: config.archer.projectileCapacity,
  });
}

function resolveArrowProjectileSystemConfig(config: ProceduralUnitConfig) {
  return {
    fixedStep: config.archer.projectileFixedStep,
    gravity: config.archer.projectileGravity,
    maxSubsteps: 8,
    stickSeconds: config.archer.projectileStickSeconds,
    sweepRadius: config.archer.projectileSweepRadius,
    visualScale: 1,
  };
}

function createGymScene(stage: Group): Scene {
  const scene = new Scene();
  scene.background = new Color(0x070b13);
  scene.fog = new Fog(0x070b13, 11, 22);
  scene.add(stage);

  const hemisphere = new HemisphereLight(0xb9d6ff, 0x17121c, 1.6);
  const key = new DirectionalLight(0xfff1d2, 3.4);
  key.position.set(4.5, 7.5, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -2;
  const rim = new SpotLight(0x8c6cff, 65, 14, Math.PI / 5, 0.7, 1.4);
  rim.position.set(-4, 4.5, -3.5);
  rim.target.position.set(0, 1.2, 0);
  scene.add(hemisphere, key, rim, rim.target);

  const floorGeometry = new PlaneGeometry(13.6, 13.6, 36, 36);
  floorGeometry.rotateX(-Math.PI / 2);
  const floorMaterial = new MeshStandardMaterial({ color: 0x141b25, metalness: 0.28, roughness: 0.78 });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = "character-gym-floor";
  stage.add(floor);

  const ringGeometry = new RingGeometry(1.45, 1.48, 96);
  const ringMaterial = new MeshStandardMaterial({ color: 0x8f7ac9, emissive: 0x342458, emissiveIntensity: 0.7 });
  const ring = new Mesh(ringGeometry, ringMaterial);
  ring.name = "character-gym-ring";
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.006;
  stage.add(ring);

  const grid = new GridHelper(13.6, 34, 0x685a88, 0x26303c);
  grid.position.y = 0.012;
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  stage.add(grid, new AxesHelper(0.7));
  return scene;
}

function createGymCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(38, 1, 0.05, 60);
  camera.position.set(8.4, 4.4, 11.5);
  return camera;
}

function createGymControls(camera: PerspectiveCamera, element: HTMLCanvasElement): OrbitControls {
  const controls = new OrbitControls(camera, element);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.target.set(0, 1.35, 2.35);
  controls.minDistance = 0.4;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI / 2.03;
  controls.autoRotateSpeed = 0.6;
  controls.update();
  return controls;
}

function disposeStage(stage: Group): void {
  stage.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
  stage.clear();
}

function resolveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Jolt physics action failed";
}

function updateGymTerrain(stage: Group, config: ProceduralUnitConfig): void {
  const floor = stage.getObjectByName("character-gym-floor");
  if (!(floor instanceof Mesh)) return;
  const positions = floor.geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    positions.setY(index, sampleProceduralHorseTerrain(config.horse, x, z).height);
  }
  positions.needsUpdate = true;
  floor.geometry.computeVertexNormals();
  const ring = stage.children.find((child) => child.name === "character-gym-ring");
  if (ring) ring.position.y = sampleProceduralHorseTerrain(config.horse, 0, 0).height + 0.01;
}

function resolveExpectedPhysicsCounts(kind: ProceduralUnitConfig["kind"]): { bodies: number; constraints: number } {
  if (kind === "horse") return { bodies: 17, constraints: 16 };
  if (kind === "paladin") return { bodies: 28, constraints: 26 };
  return { bodies: 11, constraints: 10 };
}

function isMeleeKind(kind: ProceduralUnitConfig["kind"]): kind is "knight" | "paladin" {
  return kind === "knight" || kind === "paladin";
}

function assertCaptureSequenceMatchesKind(
  sequence: ProceduralAnimationCaptureSequence,
  kind: ProceduralUnitConfig["kind"],
): void {
  if (sequence === "archer-shot" && kind !== "archer") {
    throw new Error(`Cannot capture an archer shot for ${kind}`);
  }
  if (sequence === "melee-attack" && !isMeleeKind(kind)) {
    throw new Error(`Cannot capture a melee attack for ${kind}`);
  }
}

function resolveRuntimeCapturePhase(
  sequence: ProceduralAnimationCaptureSequence,
  character: ProceduralUnitActor,
): string {
  if (sequence === "locomotion-cycle") return "gait";
  const stats = character.getStats();
  return sequence === "archer-shot" ? stats.rangedPhase : stats.meleePhase;
}

function captureCanvasThumbnail(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
  camera: PerspectiveCamera,
  annotations?: ReturnType<typeof createProceduralAnimationFrameAnnotations>,
): { dataUrl: string | null; nonBlank: boolean } {
  const width = annotations ? 720 : 480;
  const height = Math.max(124, Math.round(width * (source.height / Math.max(1, source.width))));
  target.width = width;
  target.height = height;
  const context = target.getContext("2d", { willReadFrequently: true });
  if (!context) return { dataUrl: null, nonBlank: false };
  try {
    context.drawImage(source, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let darkest = 255;
    let lightest = 0;
    for (let offset = 0; offset < pixels.length; offset += 64) {
      const luminance = (pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / 3;
      darkest = Math.min(darkest, luminance);
      lightest = Math.max(lightest, luminance);
    }
    const nonBlank = lightest - darkest > 8;
    if (annotations) renderProceduralAnimationAnnotations(context, camera, annotations, width, height);
    return {
      dataUrl: target.toDataURL("image/webp", 0.78),
      nonBlank,
    };
  } catch {
    return { dataUrl: null, nonBlank: false };
  }
}

function nextBrowserFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
