import { RewardLabChestPresentation, type ChestPalette } from "./reward-lab-presentation";
import { ChestRelicReveal } from "../rewards/chest-relic-reveal";
import { RiftPresentation } from "../rewards/rift-presentation";
import { resolveRewardNightAmount } from "../rewards/reward-lighting";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { RewardSummoning } from "../rewards/reward-summoning";
import { AnimationMixer, Color, Group, Mesh, PerspectiveCamera, Scene, type Object3D } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import PMREMGenerator from "three/src/renderers/common/extras/PMREMGenerator.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

import { env } from "../../../env";
import { initializeRendererBackendRuntime } from "../renderer-backend-runtime";
import { configureRendererColorOutput } from "../renderer-color-output";
import { disposeSkinnedSceneTemplates } from "../characters/skinned-asset-resources";
import { gltfLoader, configureGltfTextureSupport } from "../utils/utils";
import { terrainHexToWorld } from "../terrain/terrain-coordinates";
import { ModelLabEnvironment } from "./model-lab/model-lab-environment";
import { readModelLabSettings } from "./model-lab/model-lab-settings";
import { createPipelineCompiler, type PipelineCompiler } from "../pipeline-compiler";

export const REWARD_STUDIES = [
  { id: "rift-r2", label: "R2 · Essence vortex", description: "Churning basin, geyser surge, textured liquid spray." },
  {
    id: "chest-c2",
    label: "C2 · Arcane levitator",
    description: "Turning incantation rings, shadow reveal, ground absorption.",
  },
] as const;

type StudyId = (typeof REWARD_STUDIES)[number]["id"];
export interface RewardLabSettings {
  selection: StudyId | "all";
  empty: boolean;
  paused: boolean;
  camera: "detail" | "game" | "top";
  density: boolean;
  wireframe: boolean;
  palette: ChestPalette;
  lighting: "day" | "night";
}
export interface RewardLabStats {
  seconds: number;
  fps: number;
  triangles: number;
  calls: number;
  instances: number;
}
interface RewardActor {
  object: Group;
  mixer: AnimationMixer;
  phase: number;
  summoning?: RewardSummoning;
  presentation?: RewardLabChestPresentation;
  relics?: ChestRelicReveal;
  rift?: RiftPresentation;
}
export interface RewardLab {
  configure(settings: RewardLabSettings): Promise<void>;
  seek(seconds: number): void;
  summon(): void;
  openChest(): void;
  dispose(): void;
}

export async function mountRewardLab(
  container: HTMLElement,
  signal: AbortSignal,
  onStats: (stats: RewardLabStats) => void,
): Promise<RewardLab> {
  const runtime = await initializeRendererBackendRuntime({
    envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
    isMobileDevice: window.matchMedia("(pointer: coarse)").matches,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    search: window.location.search,
  });
  let lab: RewardReviewScene | undefined;
  try {
    signal.throwIfAborted();
    lab = new RewardReviewScene(container, runtime, onStats);
    await lab.load(signal);
    return lab;
  } catch (error) {
    if (lab) lab.dispose();
    else runtime.backend.dispose?.();
    if (!signal.aborted) console.error("[RewardLab] Could not initialize the reward studies", error);
    throw error;
  }
}

type RewardRendererRuntime = Awaited<ReturnType<typeof initializeRendererBackendRuntime>>;

class RewardReviewScene implements RewardLab {
  private readonly scene = new Scene();
  private readonly stage = new Group();
  private readonly relicRenderer = new CSS2DRenderer();
  private readonly camera = new PerspectiveCamera(36, 1, 0.05, 120);
  private readonly environment: ModelLabEnvironment;
  private readonly controls: OrbitControls;
  private readonly observer: ResizeObserver;
  private readonly templates = new Map<StudyId, GLTF>();
  private readonly compilePipelines: PipelineCompiler;
  private preparation: Promise<void> | null = null;
  private reflectionMap?: ReturnType<PMREMGenerator["fromScene"]>;
  private actors: RewardActor[] = [];
  private disposed = false;
  private frameId = 0;
  private seconds = 0;
  private previous = performance.now();
  private lastStats = this.previous;
  private frames = 0;
  private needsRender = true;
  private settings: RewardLabSettings = {
    selection: "all",
    empty: false,
    paused: false,
    camera: "detail",
    density: false,
    wireframe: false,
    palette: "lavender",
    lighting: "day",
  };

  constructor(
    private readonly container: HTMLElement,
    private readonly runtime: RewardRendererRuntime,
    private readonly onStats: (stats: RewardLabStats) => void,
  ) {
    const renderer = runtime.renderer;
    this.compilePipelines = createPipelineCompiler({ getRenderer: () => renderer, getCamera: () => this.camera });
    configureRendererColorOutput(renderer);
    configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);
    renderer.autoClear = true;
    this.scene.background = new Color(0x819997);
    this.scene.add(this.stage);
    this.environment = new ModelLabEnvironment(this.scene);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 30;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    renderer.domElement.setAttribute("aria-label", "Reward tile models. Drag to orbit; scroll to zoom.");
    container.append(renderer.domElement);
    this.relicRenderer.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none;";
    container.append(this.relicRenderer.domElement);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
  }

  async load(signal: AbortSignal): Promise<void> {
    await this.loadModelsAndTerrain();
    signal.throwIfAborted();
    this.configureReflections();
    this.arrangeStudies();
    this.resetCamera();
    this.resize();
    await this.prepareStudyRendering();
    signal.throwIfAborted();
    this.previous = performance.now();
    this.frameId = requestAnimationFrame(() => this.frame());
  }

  async configure(next: RewardLabSettings): Promise<void> {
    if (this.disposed) return;
    const layoutChanged =
      this.settings.selection !== next.selection ||
      this.settings.density !== next.density ||
      this.settings.palette !== next.palette;
    const cameraChanged = this.settings.camera !== next.camera;
    this.settings = next;
    this.scene.environmentIntensity = next.lighting === "night" ? 0.12 : 0.6;
    this.needsRender = true;
    if (layoutChanged) this.arrangeStudies();
    for (const actor of this.actors) {
      actor.presentation?.setLighting(next.lighting);
      actor.rift?.setNightAmount(resolveRewardNightAmount(next.lighting === "night" ? 0 : 42));
    }
    if (layoutChanged || cameraChanged) this.resetCamera();
    this.applyReviewState();
    if (layoutChanged) await this.prepareStudyRendering();
  }

  private async prepareStudyRendering(): Promise<void> {
    // Playback stays paused until the real objects' hidden effects are compiled.
    const visibility: Array<{ part: Object3D; visible: boolean; frustumCulled: boolean }> = [];
    this.stage.traverse((part) => {
      visibility.push({ part, visible: part.visible, frustumCulled: part.frustumCulled });
      part.visible = true;
      part.frustumCulled = false;
    });
    const preparation = this.compilePipelines(this.stage, this.scene);
    this.preparation = preparation;
    try {
      await preparation;
    } finally {
      for (const { part, visible, frustumCulled } of visibility) {
        part.visible = visible;
        part.frustumCulled = frustumCulled;
      }
      if (this.preparation === preparation) this.preparation = null;
      this.previous = performance.now();
      this.needsRender = true;
    }
  }

  seek(time: number): void {
    this.clearRelicReveals();
    this.seconds = Math.max(0, Math.min(8, time));
    this.needsRender = true;
    this.sampleAnimation();
    for (const actor of this.actors) actor.summoning?.seek(this.seconds);
  }

  openChest(): void {
    for (const actor of this.actors) {
      if (!actor.summoning) continue;
      actor.summoning.seek(1);
      actor.summoning.open();
      actor.relics?.dispose();
      // Preview rewards only; live openings use the three IDs from the game event.
      actor.relics = new ChestRelicReveal([39, 40, 41]);
      actor.object.add(actor.relics.label);
    }
    this.needsRender = true;
  }

  summon(): void {
    this.clearRelicReveals();
    this.seconds = 0;
    this.sampleAnimation();
    for (const actor of this.actors) actor.summoning?.restart();
    this.needsRender = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.controls.dispose();
    this.releaseActors();
    disposeSkinnedSceneTemplates([...this.templates.values()].map(({ scene }) => scene));
    this.environment.dispose();
    this.reflectionMap?.dispose();
    this.runtime.backend.dispose?.();
    this.runtime.renderer.domElement.remove();
    this.relicRenderer.domElement.remove();
  }

  private async loadModelsAndTerrain(): Promise<void> {
    const terrain = readModelLabSettings(new URLSearchParams({ family: "knight", biome: "desert" }));
    const results = await Promise.allSettled([
      this.environment.update(terrain),
      ...REWARD_STUDIES.map(async ({ id }) => {
        this.templates.set(
          id,
          await gltfLoader.loadAsync(`/models/reward-tiles/${id === "chest-c2" ? "chest" : "rift"}.glb`),
        );
      }),
    ]);
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }

  private configureReflections(): void {
    const generator = new PMREMGenerator(
      this.runtime.renderer as unknown as ConstructorParameters<typeof PMREMGenerator>[0],
    );
    const studio = new RoomEnvironment();
    try {
      this.reflectionMap = generator.fromScene(studio, 0.04);
      this.scene.environment = this.reflectionMap.texture;
      this.scene.environmentIntensity = 0.6;
    } finally {
      studio.dispose();
      generator.dispose();
    }
  }

  private arrangeStudies(): void {
    this.releaseActors();
    const selected = REWARD_STUDIES.filter(
      ({ id }) => this.settings.selection === "all" || this.settings.selection === id,
    );
    const count = selected.length * (this.settings.density ? 4 : 1);
    for (let slot = 0; slot < count; slot++) {
      const actor = this.createActor(selected[slot % selected.length].id, slot, count);
      this.actors.push(actor);
      this.stage.add(actor.object);
    }
    this.applyReviewState();
  }

  private createActor(id: StudyId, slot: number, count: number): RewardActor {
    const template = this.templates.get(id);
    if (!template) throw new Error(`Reward study ${id} did not load`);
    const object = clone(template.scene) as Group;
    this.placeOnTerrain(object, slot, count);
    object.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      part.castShadow = !part.name.includes("Essence");
      part.receiveShadow = true;
    });
    const presentation = id === "chest-c2" ? new RewardLabChestPresentation(object, this.settings.palette) : undefined;
    const rift = id === "rift-r2" ? new RiftPresentation(object) : undefined;
    rift?.setNightAmount(resolveRewardNightAmount(this.settings.lighting === "night" ? 0 : 42));
    const summoning = id === "chest-c2" ? new RewardSummoning(object, this.scene) : undefined;
    presentation?.setLighting(this.settings.lighting);
    presentation?.faceCamera(this.camera.position);
    const mixer = new AnimationMixer(object);
    for (const clip of template.animations) mixer.clipAction(clip).play();
    return {
      object,
      mixer,
      phase: this.settings.density ? slot * 0.67 : 0,
      summoning,
      presentation,
      rift,
    };
  }

  private placeOnTerrain(object: Group, slot: number, count: number): void {
    const width = Math.ceil(Math.sqrt(count));
    const position = terrainHexToWorld((slot % width) * 2, Math.floor(slot / width) * 2);
    object.position.set(position.x - (width - 1) * Math.sqrt(3), 0, position.z - (Math.ceil(count / width) - 1) * 1.5);
    object.position.y = this.environment.terrain.sampleSurface(object.position.x, object.position.z).height + 0.025;
  }

  private releaseActors(): void {
    this.clearRelicReveals();
    for (const { mixer, object, summoning, presentation, rift } of this.actors) {
      summoning?.dispose();
      presentation?.dispose();
      rift?.dispose();
      mixer.stopAllAction();
      mixer.uncacheRoot(object);
      object.removeFromParent();
    }
    this.actors = [];
  }

  private clearRelicReveals(): void {
    for (const actor of this.actors) {
      actor.relics?.dispose();
      actor.relics = undefined;
    }
  }

  private applyReviewState(): void {
    for (const { object } of this.actors) {
      object.traverse((part) => {
        if (part.name.startsWith("EssenceActive")) part.visible = !this.settings.empty;
        if (!(part instanceof Mesh)) return;
        const materials = Array.isArray(part.material) ? part.material : [part.material];
        for (const material of materials) {
          if ("wireframe" in material) material.wireframe = this.settings.wireframe;
        }
      });
    }
    this.sampleAnimation();
  }

  private sampleAnimation(): void {
    for (const actor of this.actors) actor.mixer.setTime((this.seconds + actor.phase) % 8);
  }

  private frame(): void {
    if (this.disposed) return;
    const now = performance.now();
    const delta = Math.min((now - this.previous) / 1000, 0.1);
    this.previous = now;
    if (this.preparation) {
      this.frameId = requestAnimationFrame(() => this.frame());
      return;
    }
    if (!this.settings.paused) this.seconds = (this.seconds + delta) % 8;
    const cameraMoved = this.controls.update();
    if (!this.settings.paused || this.needsRender || cameraMoved) {
      this.sampleAnimation();
      for (const actor of this.actors) {
        actor.presentation?.faceCamera(this.camera.position);
        actor.summoning?.update(this.settings.paused ? 0 : delta);
        if (actor.relics && actor.summoning) {
          actor.relics.update(actor.summoning.openingElapsed);
          if (actor.summoning.isAbsorbed) {
            actor.relics.dispose();
            actor.relics = undefined;
          }
        }
      }
      this.environment.frame(this.settings.paused ? 0 : delta, this.controls.target, this.settings.lighting);
      this.runtime.renderer.info.reset();
      this.runtime.renderer.render(this.scene, this.camera);
      this.relicRenderer.render(this.scene, this.camera);
      this.publishStats(now, this.needsRender);
      this.needsRender = false;
    }
    this.frameId = requestAnimationFrame(() => this.frame());
  }

  private publishStats(now: number, force: boolean): void {
    this.frames++;
    if (!force && now - this.lastStats <= 250) return;
    const { render } = this.runtime.renderer.info;
    this.onStats({
      seconds: this.seconds,
      fps: Math.round((this.frames * 1000) / (now - this.lastStats)),
      triangles: render.triangles,
      calls: render.drawCalls ?? render.calls,
      instances: this.actors.length,
    });
    this.lastStats = now;
    this.frames = 0;
  }

  private resetCamera(): void {
    const spread = this.settings.density ? 2.2 : this.settings.selection === "all" ? 1 : 0.52;
    const poses = { detail: [3, 5, 6], game: [2, 12, 10], top: [0, 10, 0.01] };
    this.controls.target.set(0, this.settings.selection === "chest-c2" ? 0.55 : 0.25, 0);
    this.camera.position.fromArray(poses[this.settings.camera]).multiplyScalar(spread);
    this.controls.update();
  }

  private resize(): void {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.runtime.renderer.setSize(width, height);
    this.relicRenderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }
}
