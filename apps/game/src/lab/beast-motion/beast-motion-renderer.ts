import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, beastOfModel } from "@bibliothecadao/types";
import {
  AmbientLight,
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SkinnedMesh,
  Vector3,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { env } from "../../../env";
import {
  ProceduralCharacterPerformanceEvaluator,
  type ProceduralCharacterPerformanceEvaluation,
} from "@/three/characters/benchmark/procedural-character-performance-evaluation";
import { ProceduralCharacterGpuTimer } from "@/three/characters/benchmark/procedural-character-gpu-timer";
import { HEX_SIZE } from "@/three/constants/scene-constants";
import { WorldAtmosphereController, type AtmosphereEnvironment } from "@/three/effects/world-atmosphere-controller";
import { configureWorldSunShadows } from "@/three/effects/world-sun-shadows";
import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { initializeRendererBackendRuntime } from "@/three/renderer-backend-runtime";
import { configureRendererColorOutput } from "@/three/renderer-color-output";
import { getRendererDiagnosticActiveMode } from "@/three/renderer-diagnostics";
import { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { terrainHexCorners, terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { TerrainCellInput, TerrainPageRequest } from "@/three/terrain/terrain-types";
import { configureGltfTextureSupport, gltfLoader } from "@/three/utils/gltf-loader";
import { isCoarsePointer } from "@/utils/pointer";
import {
  createBeastMotionController,
  encodeBeastIdle,
  type BeastMotionController,
} from "@/three/structures/beast-motion";
import { FRONTIER_BEASTS, type FrontierSpecies } from "@/three/structures/frontier-beast";
import { createBeastEmberGeometry } from "@/three/structures/frontier-model";
import {
  BEAST_MOTION_ACTIONS,
  BEAST_MOTION_ACTION_INDEX,
  BEAST_MOTION_COUNTS,
  BEAST_MOTION_CYCLE_SECONDS,
  BEAST_MOTION_HYBRID_BONE_COUNT,
  BEAST_MOTION_WAY_LABELS,
  BEAST_MOTION_WAYS,
  WYVERN_FULL_RIG_SPECS,
  applyBeastSpatialSkinning,
  buildFullBeastRigClips,
  computeHexFormationOffsets,
  createBeastHybridSkeleton,
  createFullBeastSkeleton,
  poseBeastHybridRig,
  sampleBeastMotionCycle,
  type BeastMotionAction,
  type BeastMotionCount,
  type BeastMotionLayer,
  type BeastMotionState,
  type BeastMotionWay,
  type BuiltBeastRig,
} from "./beast-motion-model";
import {
  createBeastShaderUniforms,
  createHybridBeastMaterial,
  createPureMathsBeastMaterial,
  createRigBeastMaterial,
  createSharedEmberPool,
  type BeastShaderUniforms,
} from "./beast-motion-phoenix";
import {
  BEAST_FAMILY_LABELS,
  BEAST_FAMILY_SHOWCASE_IDS,
  BeastFamilyStage,
  resolveFamilyMembers,
  type BeastFamilyShowcaseId,
} from "./beast-family-stage";

interface BeastRosterEntry {
  readonly species: FrontierSpecies;
  readonly name: string;
  readonly layer: BeastMotionLayer;
  readonly path: string;
}

interface BeastRosterFamily {
  readonly id: BeastFamilyShowcaseId;
  readonly label: string;
  readonly layer: BeastMotionLayer;
  readonly members: readonly BeastRosterEntry[];
}

export interface BeastMotionMeta {
  modelPath: string;
  trianglesPerBeast: number;
  actions: readonly BeastMotionAction[];
  ways: readonly BeastMotionWay[];
  counts: readonly BeastMotionCount[];
  families: ReadonlyArray<{ id: BeastFamilyShowcaseId; layer: BeastMotionLayer }>;
  roster: readonly BeastRosterFamily[];
}

const MAX_BEAST_MOTION_COUNT = Math.max(...BEAST_MOTION_COUNTS);

export interface BeastMotionStats {
  species: FrontierSpecies;
  modelPath: string;
  trianglesPerBeast: number;
  rendererMode: string;
  drawCalls: number;
  triangles: number;
  beastCount: number;
  activeBones: number;
  fps: number;
  averageFrameMs: number;
  p95FrameMs: number;
  animationCpuMs: number;
  renderCpuMs: number;
  totalCpuMs: number;
  gpuFrameMs: number | null;
  bottleneck: string;
  performance: ProceduralCharacterPerformanceEvaluation;
  seconds: number;
}

export interface BeastMotionMeasurement {
  species: FrontierSpecies;
  way: BeastMotionWay | "compare" | "families";
  count: number;
  action: BeastMotionAction;
  layer: BeastMotionLayer;
  rendererMode: string;
  viewport: { width: number; height: number; pixelRatio: number };
  sampleCount: number;
  frameMedianMs: number;
  frameMinMs: number;
  frameMaxMs: number;
  frameAverageMs: number;
  frameP95Ms: number;
  frameP99Ms: number;
  animationCpuAvgMs: number;
  animationCpuP95Ms: number;
  renderCpuAvgMs: number;
  renderCpuP95Ms: number;
  totalCpuAvgMs: number;
  totalCpuP95Ms: number;
  gpuFrameAvgMs: number | null;
  gpuFrameP95Ms: number | null;
  drawCalls: number;
  triangles: number;
  activeBones: number;
  bottleneck: string;
}

export interface BeastMotionLabel {
  key: string;
  text: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface BeastMotionRendererHandle {
  updateState(next: BeastMotionState): void;
  resetCamera(): void;
  measure(samples?: number, warmup?: number): Promise<BeastMotionMeasurement>;
  getStats(): BeastMotionStats;
  getMeta(): BeastMotionMeta;
  isFamilyReady(): boolean;
  isSpeciesReady(): boolean;
  dispose(): void;
}

interface MountBeastMotionInput {
  container: HTMLElement;
  initialState: BeastMotionState;
  signal: AbortSignal;
  onStats(stats: BeastMotionStats): void;
  onLabels(labels: BeastMotionLabel[]): void;
}

interface LoopRenderer extends RendererSurfaceLike {
  getContext?(): WebGLRenderingContext;
  setAnimationLoop(callback: (() => void) | null): void;
}

interface BeastMeshPart {
  readonly baseGeometry: BufferGeometry;
  readonly fullSkinnedGeometry: BufferGeometry;
  readonly hybridSkinnedGeometry: BufferGeometry;
  readonly mathsMaterial: ReturnType<typeof createPureMathsBeastMaterial>;
  readonly rigMaterial: ReturnType<typeof createRigBeastMaterial>;
  readonly hybridMaterial: ReturnType<typeof createHybridBeastMaterial>;
}

interface LoadedBeastAsset {
  readonly species: FrontierSpecies;
  readonly path: string;
  readonly bounds: Box3;
  readonly trianglesPerBeast: number;
  readonly parts: readonly BeastMeshPart[];
  readonly mathsMotionController: BeastMotionController;
  readonly mathsIdleAttribute: InstancedBufferAttribute;
}

interface RigActor {
  meshes: SkinnedMesh[];
  rig: BuiltBeastRig;
  mixer: AnimationMixer;
  actions: Record<BeastMotionAction, AnimationAction>;
  phaseOffset: number;
}

interface HybridActor {
  meshes: SkinnedMesh[];
  rig: BuiltBeastRig;
  phaseOffset: number;
}

interface PendingMeasurement {
  evaluator: ProceduralCharacterPerformanceEvaluator;
  frameSamples: number[];
  resolve(result: BeastMotionMeasurement): void;
}

const COMPARE_SLOTS: ReadonlyArray<{ way: BeastMotionWay; x: number; z: number }> = [
  { way: "maths", x: -2.2, z: 0 },
  { way: "rig", x: 0, z: 0 },
  { way: "hybrid", x: 2.2, z: 0 },
];

const LAYER_ENVIRONMENTS: Record<BeastMotionLayer, AtmosphereEnvironment> = {
  0: "world",
  1: "veil",
  2: "hollow",
  3: "deep",
};

const LAYER_BG: Record<BeastMotionLayer, number> = {
  0: 0x819997,
  1: 0x263140,
  2: 0x1b1526,
  3: 0x15223d,
};

const COMPARE_ANCHOR_POS = new Vector3();
const MATRIX_TMP = new Matrix4();
const BOUNDS_SIZE_TMP = new Vector3();

function createTerrainRequest(): TerrainPageRequest {
  const cells: TerrainCellInput[] = [];
  const halo: TerrainCellInput[] = [];
  for (let row = -14; row <= 14; row++) {
    for (let col = -14; col <= 14; col++) {
      const cell = {
        col,
        row,
        biome: BiomeType.Grassland,
        previewBiome: BiomeType.Grassland,
        explored: true,
        occupied: false,
      };
      (Math.abs(row) <= 12 && Math.abs(col) <= 12 ? cells : halo).push(cell);
    }
  }
  return {
    cells,
    halo,
    climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
    mapCenter: 0,
    pageKey: "beast-motion-lab:grassland",
    roadSegments: [],
    settlementAnchors: [],
  };
}

class BeastMotionEnvironment {
  public readonly terrain = new ProceduralTerrain();
  private readonly atmosphere: WorldAtmosphereController;
  private readonly sun = new DirectionalLight();
  private readonly ambient = new AmbientLight();
  private readonly hemisphere = new HemisphereLight();
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
    configureWorldSunShadows(this.sun, true, 2048);
    scene.add(this.terrain.object3d, this.sun, this.sun.target, this.ambient, this.hemisphere);
    this.atmosphere = new WorldAtmosphereController(scene, this.sun, this.hemisphere, this.ambient, new Fog(0x819997));
    this.terrain.setQuality("high");
  }

  async init(): Promise<void> {
    await this.terrain.loadProps();
    const page = await this.terrain.preparePageAsync(createTerrainRequest());
    const fog = await this.terrain.prepareFogMaskAsync([page]);
    this.terrain.present([page], fog);
    this.terrain.refreshPropOccupancy((col, row) => {
      const { x, z } = terrainHexToWorld(col, row);
      return Math.abs(x) < 18 && Math.abs(z) < 18;
    });
  }

  frame(delta: number, target: Vector3, layer: BeastMotionLayer): void {
    this.terrain.update(delta);
    this.scene.background = new Color(LAYER_BG[layer]);
    this.atmosphere.update(42, target, { snap: true, environment: LAYER_ENVIRONMENTS[layer] });
  }

  dispose(): void {
    this.terrain.dispose();
    this.terrain.object3d.removeFromParent();
    this.atmosphere.dispose();
    this.sun.shadow.dispose();
    [this.sun, this.sun.target, this.ambient, this.hemisphere].forEach((light) => light.removeFromParent());
  }
}

async function loadBeastAsset(species: FrontierSpecies, uniforms: BeastShaderUniforms): Promise<LoadedBeastAsset> {
  const path = FRONTIER_BEASTS[species].path;
  const gltf = await gltfLoader.loadAsync(path);
  const bounds = new Box3().setFromObject(gltf.scene);
  const sourceMeshes: Mesh[] = [];
  gltf.scene.traverse((node) => {
    if (node instanceof Mesh) sourceMeshes.push(node);
  });
  if (sourceMeshes.length === 0) {
    throw new Error(`Beast mesh not found in ${path}`);
  }

  const mathsMotionController = createBeastMotionController(species, MAX_BEAST_MOTION_COUNT);
  const mathsIdleAttribute = new InstancedBufferAttribute(new Float32Array(MAX_BEAST_MOTION_COUNT * 3), 3);
  const [idleMotion, idleSpeed, idleHeight] = encodeBeastIdle(beastOfModel(species).idle);
  for (let i = 0; i < MAX_BEAST_MOTION_COUNT; i++) {
    mathsIdleAttribute.setXYZ(i, idleMotion, idleSpeed, idleHeight);
  }

  let trianglesPerBeast = 0;
  const parts: BeastMeshPart[] = sourceMeshes.map((sourceMesh) => {
    const baseGeometry = sourceMesh.geometry.clone();
    trianglesPerBeast += measureGeometryTriangles(baseGeometry);
    baseGeometry.setAttribute("beastIdle", mathsIdleAttribute);
    baseGeometry.setAttribute("beastMotion", mathsMotionController.attribute);
    baseGeometry.computeBoundingBox();
    baseGeometry.boundingBox?.expandByScalar(1.2);
    baseGeometry.computeBoundingSphere();
    if (baseGeometry.boundingSphere) baseGeometry.boundingSphere.radius += 1.2;

    const fullSkinnedGeometry = applyBeastSpatialSkinning(baseGeometry, species, bounds, "full");
    const hybridSkinnedGeometry = applyBeastSpatialSkinning(baseGeometry, species, bounds, "hybrid");

    const sourceMaterial = Array.isArray(sourceMesh.material)
      ? (sourceMesh.material[0] as MeshStandardMaterial)
      : (sourceMesh.material as MeshStandardMaterial);

    return {
      baseGeometry,
      fullSkinnedGeometry,
      hybridSkinnedGeometry,
      mathsMaterial: createPureMathsBeastMaterial(sourceMaterial, uniforms, species),
      rigMaterial: createRigBeastMaterial(sourceMaterial, uniforms),
      hybridMaterial: createHybridBeastMaterial(sourceMaterial, uniforms, species, bounds),
    };
  });

  return {
    species,
    path,
    bounds,
    trianglesPerBeast,
    parts,
    mathsMotionController,
    mathsIdleAttribute,
  };
}

function disposeBeastAsset(asset: LoadedBeastAsset): void {
  for (const part of asset.parts) {
    part.baseGeometry.dispose();
    part.fullSkinnedGeometry.dispose();
    part.hybridSkinnedGeometry.dispose();
    part.mathsMaterial.dispose();
    part.rigMaterial.dispose();
    part.hybridMaterial.dispose();
  }
}

export async function mountBeastMotionRenderer(input: MountBeastMotionInput): Promise<BeastMotionRendererHandle> {
  const rendererRuntime = await initializeRendererBackendRuntime({
    envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
    isMobileDevice: isCoarsePointer(),
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    postProcessing: true,
    search: window.location.search,
  });
  if (input.signal.aborted) {
    rendererRuntime.backend.dispose();
    input.signal.throwIfAborted();
  }
  configureGltfTextureSupport(rendererRuntime.renderer as Parameters<typeof configureGltfTextureSupport>[0]);
  const uniforms = createBeastShaderUniforms();
  const initialAsset = await loadBeastAsset(input.initialState.species, uniforms);
  if (input.signal.aborted) {
    disposeBeastAsset(initialAsset);
    rendererRuntime.backend.dispose();
    input.signal.throwIfAborted();
  }

  const stage = new BeastMotionStage(input, rendererRuntime, uniforms, initialAsset);
  try {
    await stage.init();
    input.signal.throwIfAborted();
    return stage;
  } catch (error) {
    stage.dispose();
    throw error;
  }
}

class BeastMotionStage implements BeastMotionRendererHandle {
  private readonly scene = new Scene();
  private readonly stageGroup = new Group();
  private readonly hexOutlineGroup = new Group();
  private readonly camera = new PerspectiveCamera(37, 1, 0.1, 220);
  private readonly renderer: LoopRenderer;
  private readonly controls: OrbitControls;
  private readonly observer: ResizeObserver;
  private readonly environment: BeastMotionEnvironment;
  private readonly gpuTimer: ProceduralCharacterGpuTimer;
  private readonly uniforms: BeastShaderUniforms;
  private readonly rigClips: Record<BeastMotionAction, AnimationClip>;
  private readonly emberPool: InstancedMesh;
  private readonly familyStage = new BeastFamilyStage();
  private readonly assetCache = new Map<FrontierSpecies, LoadedBeastAsset>();

  private activeAsset: LoadedBeastAsset;
  private speciesGeneration = 0;
  private speciesLoaded = true;
  private state: BeastMotionState;
  private stageSignature = "";
  private activeMathsMeshes: InstancedMesh[] = [];
  private mathsPlacements: Array<{ x: number; y: number; z: number }> = [];
  private mathsActionCycle = -1;
  private rigActors: RigActor[] = [];
  private hybridActors: HybridActor[] = [];
  private activeAction: BeastMotionAction;
  private familyLoaded = false;
  private familyActionTimer = 0;
  private seconds = 0;
  private lastFrameMs = performance.now();
  private lastStatsMs = this.lastFrameMs;
  private frames = 0;
  private fps = 0;
  private lastDrawCalls = 0;
  private lastTriangles = 0;
  private disposed = false;
  private continuousEvaluator = new ProceduralCharacterPerformanceEvaluator(30, 120);
  private pendingMeasurement: PendingMeasurement | null = null;

  constructor(
    private readonly input: MountBeastMotionInput,
    private readonly rendererRuntime: Awaited<ReturnType<typeof initializeRendererBackendRuntime>>,
    uniforms: BeastShaderUniforms,
    initialAsset: LoadedBeastAsset,
  ) {
    this.state = { ...input.initialState };
    this.activeAction = this.state.action;
    this.uniforms = uniforms;
    this.activeAsset = initialAsset;
    this.assetCache.set(initialAsset.species, initialAsset);
    this.renderer = rendererRuntime.renderer as LoopRenderer;
    configureRendererColorOutput(this.renderer);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.gpuTimer = new ProceduralCharacterGpuTimer(this.renderer);
    this.continuousEvaluator.setGpuTimerSupported(this.gpuTimer.supported);

    this.scene.background = new Color(LAYER_BG[this.state.layer]);
    this.scene.add(this.stageGroup, this.hexOutlineGroup, this.familyStage.group);
    this.environment = new BeastMotionEnvironment(this.scene);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 85;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.renderer.domElement.setAttribute("aria-label", "Beast motion comparison stage");
    input.container.append(this.renderer.domElement);

    const templateRig = createFullBeastSkeleton();
    this.rigClips = buildFullBeastRigClips(templateRig.restPositions);
    templateRig.skeleton.dispose();

    this.emberPool = createSharedEmberPool(this.activeAsset.bounds, MAX_BEAST_MOTION_COUNT, this.uniforms);
    this.scene.add(this.emberPool);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(input.container);
    this.resize();
  }

  async init(): Promise<void> {
    await this.environment.init();
    if (this.disposed) return;
    this.rebuildStage();
    this.resetCamera();
    this.syncUniforms();
    this.stepActors(0);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  updateState(next: BeastMotionState): void {
    const previous = this.state;
    this.state = { ...next };
    const speciesChanged = previous.species !== next.species;
    const topologyChanged =
      speciesChanged ||
      previous.mode !== next.mode ||
      (next.mode === "bench" && (previous.way !== next.way || previous.count !== next.count)) ||
      (next.mode === "families" && previous.family !== next.family);
    const cameraChanged = topologyChanged || previous.camera !== next.camera;
    const actionChanged = previous.action !== next.action;

    if (speciesChanged && next.mode !== "families") {
      this.ensureSpeciesLoaded(next.species);
    } else if (topologyChanged) {
      this.rebuildStage();
      this.continuousEvaluator.reset();
    }

    if (actionChanged) {
      this.activeAction = next.action;
      this.seconds = 0;
      this.familyActionTimer = 0;
      this.mathsActionCycle = -1;
      this.resetMathsTransformsAndSlots();
      this.switchRigClips(next.action);
      if (this.state.mode === "families") {
        this.triggerFamilyAction(next.action);
      }
    }
    if (cameraChanged && this.speciesLoaded) {
      this.resetCamera();
    }
    this.syncUniforms();
    if (this.state.paused) {
      this.stepActors(0);
    }
  }

  isFamilyReady(): boolean {
    return this.state.mode !== "families" || this.familyLoaded;
  }

  isSpeciesReady(): boolean {
    return this.speciesLoaded && this.activeAsset.species === this.state.species;
  }

  getMeta(): BeastMotionMeta {
    const roster = BEAST_FAMILY_SHOWCASE_IDS.map((id) => {
      const members = resolveFamilyMembers(id).map((member) => ({
        species: member.species,
        name: member.name,
        layer: member.layer,
        path: FRONTIER_BEASTS[member.species].path,
      }));
      return {
        id,
        label: BEAST_FAMILY_LABELS[id],
        layer: members[0]?.layer ?? 0,
        members,
      };
    });
    return {
      modelPath: this.activeAsset.path,
      trianglesPerBeast: this.activeAsset.trianglesPerBeast,
      actions: BEAST_MOTION_ACTIONS,
      ways: BEAST_MOTION_WAYS,
      counts: BEAST_MOTION_COUNTS,
      families: roster.map(({ id, layer }) => ({ id, layer })),
      roster,
    };
  }

  resetCamera(): void {
    const groundY = this.environment.terrain.sampleHeight(0, 0);
    const bounds = this.activeAsset.bounds;
    const centerY = groundY + Math.max(0.46, (bounds.min.y + bounds.max.y) * 0.5);
    if (this.state.mode === "families") {
      const isDeep = this.state.family === "deep";
      if (this.state.camera === "phoneMap") {
        this.controls.target.set(0, groundY + 0.55, 0);
        this.camera.position.set(0, groundY + (isDeep ? 17.5 : 15.2), isDeep ? 15.4 : 13.4);
      } else {
        this.controls.target.set(0, groundY + 0.55, 0);
        this.camera.position.set(0.35, groundY + (isDeep ? 3.8 : 3.2), isDeep ? 8.2 : 6.8);
      }
      this.controls.update();
      return;
    }
    if (this.state.mode === "bench") {
      if (this.state.count === 1 && this.state.camera === "close") {
        bounds.getSize(BOUNDS_SIZE_TMP);
        const radius = Math.max(BOUNDS_SIZE_TMP.length() * 0.5, 0.58);
        this.controls.target.set(0, centerY, 0);
        this.camera.position.set(radius * 0.52, centerY + radius * 1.12, radius * 2.55);
      } else {
        const dist = this.state.count <= 1 ? 4.2 : 3.4 + Math.sqrt(this.state.count) * 2.16;
        this.controls.target.set(0, groundY + 0.55, 0);
        this.camera.position.set(dist * 0.35, groundY + dist * 0.72, dist * 0.82);
      }
    } else if (this.state.camera === "phoneMap") {
      this.controls.target.set(0, groundY + 0.55, 0);
      this.camera.position.set(0, groundY + 15.8, 13.6);
    } else if (this.state.camera === "close") {
      this.controls.target.set(0, centerY, 0);
      this.camera.position.set(0, centerY + 1.72, 4.4);
    } else {
      this.controls.target.set(0, centerY, 0);
      this.camera.position.set(0.4, centerY + 2.65, 6.4);
    }
    this.controls.update();
  }

  measure(samples = 90, warmup = 25): Promise<BeastMotionMeasurement> {
    this.state.paused = false;
    return new Promise((resolve) => {
      const evaluator = new ProceduralCharacterPerformanceEvaluator(warmup, samples);
      evaluator.setGpuTimerSupported(this.gpuTimer.supported);
      this.gpuTimer.reset();
      this.pendingMeasurement = { evaluator, frameSamples: [], resolve };
    });
  }

  getStats(): BeastMotionStats {
    const perf = this.continuousEvaluator.getSnapshot();
    const beastCount = this.state.mode === "compare" ? 3 : this.state.count;
    const activeBones = this.computeActiveBones();
    return {
      species: this.activeAsset.species,
      modelPath: this.activeAsset.path,
      trianglesPerBeast: this.activeAsset.trianglesPerBeast,
      rendererMode: getRendererDiagnosticActiveMode() ?? "unknown",
      drawCalls: this.lastDrawCalls,
      triangles: this.lastTriangles,
      beastCount,
      activeBones,
      fps: this.fps,
      averageFrameMs: perf.frameMs.average,
      p95FrameMs: perf.frameMs.p95,
      animationCpuMs: perf.animationCpuMs.average,
      renderCpuMs: perf.renderCpuMs.average,
      totalCpuMs: perf.totalCpuMs.average,
      gpuFrameMs: perf.gpuFrameMs?.average ?? null,
      bottleneck: classifyTimingBound(
        perf.animationCpuMs.average,
        perf.renderCpuMs.average,
        perf.gpuFrameMs?.average ?? null,
      ),
      performance: perf,
      seconds: this.seconds,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.controls.dispose();
    this.clearStageActors();
    this.clearHexOutlines();
    this.familyStage.dispose();
    this.emberPool.geometry.dispose();
    (this.emberPool.material as { dispose(): void }).dispose();
    this.emberPool.dispose();
    this.emberPool.removeFromParent();
    for (const asset of this.assetCache.values()) {
      disposeBeastAsset(asset);
    }
    this.assetCache.clear();
    this.gpuTimer.dispose();
    this.environment.dispose();
    this.rendererRuntime.backend.dispose();
    this.renderer.domElement.remove();
  }

  private ensureSpeciesLoaded(species: FrontierSpecies): void {
    const token = ++this.speciesGeneration;
    const cached = this.assetCache.get(species);
    if (cached) {
      this.applyLoadedAsset(cached);
      return;
    }
    this.speciesLoaded = false;
    void loadBeastAsset(species, this.uniforms)
      .then((asset) => {
        if (this.disposed) {
          disposeBeastAsset(asset);
          return;
        }
        this.assetCache.set(species, asset);
        if (token !== this.speciesGeneration) return;
        this.applyLoadedAsset(asset);
      })
      .catch((error) => {
        if (this.disposed || token !== this.speciesGeneration) return;
        this.state = { ...this.state, species: this.activeAsset.species };
        this.speciesLoaded = true;
        console.error(`[BeastMotionStage] Failed to load beast species ${species}`, error);
      });
  }

  private applyLoadedAsset(asset: LoadedBeastAsset): void {
    this.activeAsset = asset;
    this.speciesLoaded = true;
    const prevEmberGeo = this.emberPool.geometry;
    this.emberPool.geometry = createBeastEmberGeometry(asset.bounds);
    prevEmberGeo.dispose();
    this.seconds = 0;
    this.mathsActionCycle = -1;
    this.rebuildStage();
    this.continuousEvaluator.reset();
    this.resetCamera();
    this.syncUniforms();
    this.stepActors(0);
  }

  private resetMathsTransformsAndSlots(): void {
    const count = this.mathsPlacements.length;
    for (let i = 0; i < count; i++) {
      const p = this.mathsPlacements[i];
      MATRIX_TMP.makeTranslation(p.x, p.y, p.z);
      for (const mesh of this.activeMathsMeshes) {
        mesh.setMatrixAt(i, MATRIX_TMP);
      }
      this.activeAsset.mathsMotionController.resetSlot(i);
      this.activeAsset.mathsMotionController.setPlacementAt(i, MATRIX_TMP);
    }
    for (const mesh of this.activeMathsMeshes) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private rebuildStage(): void {
    const family: BeastFamilyShowcaseId = this.state.family;
    const signature =
      this.state.mode === "families"
        ? `families:${family}`
        : this.state.mode === "compare"
          ? `compare:${this.activeAsset.species}`
          : `bench:${this.activeAsset.species}:${this.state.way}:${this.state.count}`;
    if (signature === this.stageSignature) return;
    this.stageSignature = signature;
    this.clearStageActors();
    this.clearHexOutlines();
    this.familyStage.clear();
    this.familyLoaded = false;
    this.familyActionTimer = 0;

    if (this.state.mode === "families") {
      this.emberPool.count = 0;
      const expected = signature;
      void this.familyStage
        .loadFamily(family, (x, z) => this.environment.terrain.sampleHeight(x, z))
        .then(() => {
          if (this.disposed || this.stageSignature !== expected) return;
          this.familyLoaded = true;
          this.triggerFamilyAction(this.activeAction);
          this.resetCamera();
        });
      return;
    }

    if (this.state.mode === "compare") {
      this.uniforms.phaseSpread.value = 0;
      const placements = COMPARE_SLOTS.map((slot) => ({
        ...slot,
        y: this.environment.terrain.sampleHeight(slot.x, slot.z),
      }));
      this.addHexOutlines(placements);

      this.spawnPureMaths([placements[0]]);
      this.spawnRigActors([placements[1]], false);
      this.spawnHybridActors([placements[2]], false);
      this.placeEmbers(placements);
    } else {
      this.uniforms.phaseSpread.value = this.state.count > 1 ? 1 : 0;
      const offsets = computeHexFormationOffsets(this.state.count);
      const placements = offsets.map(({ x, z }) => ({
        x,
        z,
        y: this.environment.terrain.sampleHeight(x, z),
      }));
      if (this.state.count === 1) {
        this.addHexOutlines(placements);
      }
      if (this.state.way === "maths") {
        this.spawnPureMaths(placements);
      } else if (this.state.way === "rig") {
        this.spawnRigActors(placements, this.state.count > 1);
      } else {
        this.spawnHybridActors(placements, this.state.count > 1);
      }
      this.placeEmbers(placements);
    }
    this.switchRigClips(this.activeAction);
  }

  private spawnPureMaths(placements: ReadonlyArray<{ x: number; y: number; z: number }>): void {
    this.mathsPlacements = placements.map((p) => ({ ...p }));
    this.mathsActionCycle = -1;
    const meshes: InstancedMesh[] = [];
    for (const part of this.activeAsset.parts) {
      const mesh = new InstancedMesh(part.baseGeometry, part.mathsMaterial, placements.length);
      mesh.name = `Beast motion pure maths (${this.activeAsset.species})`;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        MATRIX_TMP.makeTranslation(p.x, p.y, p.z);
        mesh.setMatrixAt(i, MATRIX_TMP);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.count = placements.length;
      this.stageGroup.add(mesh);
      meshes.push(mesh);
    }
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      MATRIX_TMP.makeTranslation(p.x, p.y, p.z);
      this.activeAsset.mathsMotionController.resetSlot(i);
      this.activeAsset.mathsMotionController.setPlacementAt(i, MATRIX_TMP);
    }
    this.activeMathsMeshes = meshes;
  }

  private spawnRigActors(placements: ReadonlyArray<{ x: number; y: number; z: number }>, stagger: boolean): void {
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const rig = createFullBeastSkeleton();
      const meshes: SkinnedMesh[] = [];
      this.activeAsset.parts.forEach((part, partIndex) => {
        const mesh = new SkinnedMesh(part.fullSkinnedGeometry, part.rigMaterial);
        mesh.name = `Beast motion rig ${i}:${partIndex}`;
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(p.x, p.y, p.z);
        if (partIndex === 0) mesh.add(rig.rootBone);
        mesh.bind(rig.skeleton);
        this.stageGroup.add(mesh);
        meshes.push(mesh);
      });

      const mixer = new AnimationMixer(rig.rootBone);
      const actions = {
        idle: mixer.clipAction(this.rigClips.idle),
        walk: mixer.clipAction(this.rigClips.walk),
        attack: mixer.clipAction(this.rigClips.attack),
        hit: mixer.clipAction(this.rigClips.hit),
        death: mixer.clipAction(this.rigClips.death),
      };
      this.rigActors.push({
        meshes,
        rig,
        mixer,
        actions,
        phaseOffset: stagger ? i * 2.399963 : 0,
      });
    }
  }

  private spawnHybridActors(placements: ReadonlyArray<{ x: number; y: number; z: number }>, stagger: boolean): void {
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const rig = createBeastHybridSkeleton(this.activeAsset.species, this.activeAsset.bounds);
      const meshes: SkinnedMesh[] = [];
      this.activeAsset.parts.forEach((part, partIndex) => {
        const mesh = new SkinnedMesh(part.hybridSkinnedGeometry, part.hybridMaterial);
        mesh.name = `Beast motion hybrid ${i}:${partIndex}`;
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(p.x, p.y, p.z);
        if (partIndex === 0) mesh.add(rig.rootBone);
        mesh.bind(rig.skeleton);
        this.stageGroup.add(mesh);
        meshes.push(mesh);
      });
      this.hybridActors.push({
        meshes,
        rig,
        phaseOffset: stagger ? i * 2.399963 : 0,
      });
    }
  }

  private placeEmbers(placements: ReadonlyArray<{ x: number; y: number; z: number }>): void {
    const count = Math.min(placements.length, MAX_BEAST_MOTION_COUNT);
    for (let i = 0; i < count; i++) {
      const p = placements[i];
      MATRIX_TMP.makeTranslation(p.x, p.y, p.z);
      this.emberPool.setMatrixAt(i, MATRIX_TMP);
    }
    this.emberPool.instanceMatrix.needsUpdate = true;
    this.emberPool.count = count;
  }

  private addHexOutlines(placements: ReadonlyArray<{ x: number; y: number; z: number }>): void {
    const corners = terrainHexCorners(0, 0).map(({ x, z }) => new Vector3(x * HEX_SIZE, 0, z * HEX_SIZE));
    corners.push(corners[0].clone());
    const geometry = new BufferGeometry().setFromPoints(corners);
    const material = new LineBasicMaterial({
      color: 0xe4c483,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    for (const p of placements) {
      const line = new Line(geometry, material);
      line.position.set(p.x, p.y + 0.025, p.z);
      this.hexOutlineGroup.add(line);
    }
  }

  private clearHexOutlines(): void {
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<LineBasicMaterial>();
    for (const child of this.hexOutlineGroup.children) {
      if (child instanceof Line) {
        geometries.add(child.geometry);
        materials.add(child.material as LineBasicMaterial);
      }
    }
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.hexOutlineGroup.clear();
  }

  private clearStageActors(): void {
    for (const mesh of this.activeMathsMeshes) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.activeMathsMeshes = [];
    for (const actor of this.rigActors) {
      actor.mixer.stopAllAction();
      actor.mixer.uncacheRoot(actor.rig.rootBone);
      actor.rig.skeleton.dispose();
      for (const mesh of actor.meshes) mesh.removeFromParent();
    }
    this.rigActors = [];
    for (const actor of this.hybridActors) {
      actor.rig.skeleton.dispose();
      for (const mesh of actor.meshes) mesh.removeFromParent();
    }
    this.hybridActors = [];
  }

  private switchRigClips(action: BeastMotionAction): void {
    for (const actor of this.rigActors) {
      actor.mixer.stopAllAction();
      const clipAction = actor.actions[action];
      clipAction.reset();
      clipAction.play();
      actor.mixer.setTime(this.seconds + actor.phaseOffset);
    }
  }

  private syncUniforms(): void {
    this.uniforms.time.value = this.seconds;
    this.uniforms.actionIndex.value = BEAST_MOTION_ACTION_INDEX[this.state.action];
    this.uniforms.layer.value = this.state.layer;
    this.uniforms.phoenixEnabled.value = this.state.phoenix ? 1 : 0;
  }

  private triggerFamilyAction(action: BeastMotionAction): void {
    if (action === "attack" || action === "hit" || action === "death") {
      this.familyStage.triggerAction(action);
    } else {
      this.familyStage.triggerAction("idle");
    }
  }

  private stepActors(delta: number): void {
    if (this.state.mode === "families") {
      if (this.familyLoaded) {
        if (delta > 0) {
          this.familyActionTimer += delta;
          if (this.activeAction === "attack" && this.familyActionTimer >= 1.35) {
            this.familyActionTimer = 0;
            this.familyStage.triggerAction("attack");
          } else if (this.activeAction === "hit" && this.familyActionTimer >= 1.1) {
            this.familyActionTimer = 0;
            this.familyStage.triggerAction("hit");
          } else if (this.activeAction === "death" && this.familyActionTimer >= 2.2) {
            this.familyActionTimer = 0;
            this.familyStage.triggerAction("death");
          }
        }
        this.familyStage.update(delta);
      }
      return;
    }
    if (this.activeMathsMeshes.length > 0) {
      const count = this.mathsPlacements.length;
      if (this.state.action === "walk") {
        const stagger = this.uniforms.phaseSpread.value > 0.5;
        for (let i = 0; i < count; i++) {
          const p = this.mathsPlacements[i];
          const sample = sampleBeastMotionCycle("walk", this.seconds + (stagger ? i * 2.399963 : 0));
          MATRIX_TMP.makeTranslation(p.x, p.y + sample.walkBob * 0.045, p.z + sample.walkOffsetZ);
          for (const mesh of this.activeMathsMeshes) {
            mesh.setMatrixAt(i, MATRIX_TMP);
          }
        }
        for (const mesh of this.activeMathsMeshes) {
          mesh.instanceMatrix.needsUpdate = true;
        }
      } else if (this.state.action === "attack" || this.state.action === "hit" || this.state.action === "death") {
        const cycle = Math.floor(this.seconds / BEAST_MOTION_CYCLE_SECONDS);
        if (cycle !== this.mathsActionCycle) {
          this.mathsActionCycle = cycle;
          for (let i = 0; i < count; i++) {
            this.activeAsset.mathsMotionController.playActionAt(i, this.state.action, this.seconds);
          }
        }
      }
      this.activeAsset.mathsMotionController.update(this.seconds, []);
    }
    for (const actor of this.rigActors) {
      if (delta === 0) {
        actor.mixer.setTime(this.seconds + actor.phaseOffset);
      } else {
        actor.mixer.update(delta);
      }
    }
    for (const actor of this.hybridActors) {
      poseBeastHybridRig(actor.rig, this.activeAsset.species, this.state.action, this.seconds, actor.phaseOffset);
    }
  }

  private frame(): void {
    if (this.disposed) return;
    const frameStart = performance.now();
    const frameMs = Math.max(0.1, frameStart - this.lastFrameMs);
    const delta = Math.min(frameMs / 1000, 0.05);
    this.lastFrameMs = frameStart;
    this.frames++;

    const animStart = performance.now();
    if (!this.state.paused) {
      this.seconds += delta;
      this.syncUniforms();
      this.stepActors(delta);
    } else {
      this.syncUniforms();
    }
    const animationCpuMs = performance.now() - animStart;

    this.environment.frame(this.state.paused ? 0 : delta, this.controls.target, this.state.layer);
    this.controls.update();

    const renderStart = performance.now();
    this.renderer.info.reset();
    this.gpuTimer.begin();
    this.renderer.render(this.scene, this.camera);
    this.gpuTimer.end();
    const renderCpuMs = performance.now() - renderStart;
    const totalCpuMs = performance.now() - frameStart;

    this.lastDrawCalls = this.renderer.info.render.drawCalls ?? this.renderer.info.render.calls;
    this.lastTriangles = this.renderer.info.render.triangles;

    const gpuSamples = this.gpuTimer.readAvailable();
    const sample = { animationCpuMs, collisionCpuMs: 0, frameMs, renderCpuMs, totalCpuMs };
    this.continuousEvaluator.recordFrame(sample);
    for (const gpuMs of gpuSamples) this.continuousEvaluator.recordGpuFrame(gpuMs);
    if (this.continuousEvaluator.state === "complete") {
      this.continuousEvaluator.reset();
    }

    if (this.pendingMeasurement) {
      const pending = this.pendingMeasurement;
      const wasSampling = pending.evaluator.state === "sampling";
      pending.evaluator.recordFrame(sample);
      if (wasSampling) pending.frameSamples.push(frameMs);
      for (const gpuMs of gpuSamples) pending.evaluator.recordGpuFrame(gpuMs);
      if (pending.evaluator.state === "complete") {
        this.pendingMeasurement = null;
        pending.resolve(this.buildMeasurementResult(pending));
      }
    }

    this.emitLabels();

    if (frameStart - this.lastStatsMs >= 250) {
      this.fps = Math.round((this.frames * 1000) / (frameStart - this.lastStatsMs));
      this.lastStatsMs = frameStart;
      this.frames = 0;
      this.input.onStats(this.getStats());
    }
  }

  private buildMeasurementResult(pending: PendingMeasurement): BeastMotionMeasurement {
    const snap = pending.evaluator.getSnapshot();
    const sorted = [...pending.frameSamples].sort((a, b) => a - b);
    const min = sorted[0] ?? 0;
    const max = sorted[sorted.length - 1] ?? 0;
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const beastCount = this.state.mode === "compare" ? 3 : this.state.count;
    const way = this.state.mode === "bench" ? this.state.way : this.state.mode;
    const rect = this.input.container.getBoundingClientRect();
    return {
      species: this.activeAsset.species,
      way,
      count: beastCount,
      action: this.state.action,
      layer: this.state.layer,
      rendererMode: getRendererDiagnosticActiveMode() ?? "unknown",
      viewport: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      },
      sampleCount: snap.sampleCount,
      frameMedianMs: round2(median),
      frameMinMs: round2(min),
      frameMaxMs: round2(max),
      frameAverageMs: round2(snap.frameMs.average),
      frameP95Ms: round2(snap.frameMs.p95),
      frameP99Ms: round2(snap.frameMs.p99),
      animationCpuAvgMs: round2(snap.animationCpuMs.average),
      animationCpuP95Ms: round2(snap.animationCpuMs.p95),
      renderCpuAvgMs: round2(snap.renderCpuMs.average),
      renderCpuP95Ms: round2(snap.renderCpuMs.p95),
      totalCpuAvgMs: round2(snap.totalCpuMs.average),
      totalCpuP95Ms: round2(snap.totalCpuMs.p95),
      gpuFrameAvgMs: snap.gpuFrameMs ? round2(snap.gpuFrameMs.average) : null,
      gpuFrameP95Ms: snap.gpuFrameMs ? round2(snap.gpuFrameMs.p95) : null,
      drawCalls: this.lastDrawCalls,
      triangles: this.lastTriangles,
      activeBones: this.computeActiveBones(),
      bottleneck: classifyTimingBound(
        snap.animationCpuMs.average,
        snap.renderCpuMs.average,
        snap.gpuFrameMs?.average ?? null,
      ),
    };
  }

  private computeActiveBones(): number {
    if (this.state.mode === "compare") {
      return WYVERN_FULL_RIG_SPECS.length + BEAST_MOTION_HYBRID_BONE_COUNT;
    }
    if (this.state.way === "maths") return 0;
    return (
      this.state.count * (this.state.way === "rig" ? WYVERN_FULL_RIG_SPECS.length : BEAST_MOTION_HYBRID_BONE_COUNT)
    );
  }

  private emitLabels(): void {
    const width = this.input.container.clientWidth;
    const height = this.input.container.clientHeight;
    if (this.state.mode === "families") {
      const pad = Math.min(54, width * 0.14);
      const projected = this.familyStage.getLabelAnchors().map((anchor) => {
        COMPARE_ANCHOR_POS.copy(anchor.position).project(this.camera);
        const rawX = ((COMPARE_ANCHOR_POS.x + 1) / 2) * width;
        return {
          key: anchor.name,
          text: anchor.name,
          x: Math.max(pad, Math.min(width - pad, rawX)),
          y: ((1 - COMPARE_ANCHOR_POS.y) / 2) * height,
          visible: Math.abs(COMPARE_ANCHOR_POS.z) <= 1,
        };
      });
      this.input.onLabels(projected);
      return;
    }
    if (this.state.mode === "bench" && this.state.count === 1) {
      const actionLabel = this.state.action.charAt(0).toUpperCase() + this.state.action.slice(1);
      const beastName = beastOfModel(this.activeAsset.species).name;
      this.input.onLabels([
        {
          key: "solo",
          text: `${beastName} · ${BEAST_MOTION_WAY_LABELS[this.state.way]} · ${actionLabel}`,
          x: width * 0.5,
          y: 44,
          visible: width > 0 && height > 0,
        },
      ]);
      return;
    }
    if (this.state.mode !== "compare") {
      this.input.onLabels([]);
      return;
    }
    const pad = Math.min(62, width * 0.16);
    const projected = COMPARE_SLOTS.map((slot) => {
      const groundY = this.environment.terrain.sampleHeight(slot.x, slot.z);
      COMPARE_ANCHOR_POS.set(slot.x, groundY + 1.32, slot.z).project(this.camera);
      const rawX = ((COMPARE_ANCHOR_POS.x + 1) / 2) * width;
      return {
        key: slot.way,
        text: BEAST_MOTION_WAY_LABELS[slot.way],
        x: Math.max(pad, Math.min(width - pad, rawX)),
        y: ((1 - COMPARE_ANCHOR_POS.y) / 2) * height,
        visible: Math.abs(COMPARE_ANCHOR_POS.z) <= 1,
      };
    });
    this.input.onLabels(projected);
  }

  private resize(): void {
    const { width, height } = this.input.container.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function measureGeometryTriangles(geometry: BufferGeometry): number {
  if (geometry.index) return Math.round(geometry.index.count / 3);
  const positions = geometry.getAttribute("position");
  return positions ? Math.round(positions.count / 3) : 0;
}

function classifyTimingBound(animationCpuMs: number, renderCpuMs: number, gpuFrameMs: number | null): string {
  const cpuTotalMs = animationCpuMs + renderCpuMs;
  if (gpuFrameMs !== null && gpuFrameMs > cpuTotalMs && gpuFrameMs >= 2) {
    return `GPU (${round2(gpuFrameMs)} ms vs ${round2(cpuTotalMs)} ms CPU)`;
  }
  if (animationCpuMs > renderCpuMs && animationCpuMs >= 1) {
    return `CPU animation (${round2(animationCpuMs)} ms anim vs ${round2(renderCpuMs)} ms render)`;
  }
  if (renderCpuMs >= 2) {
    return `CPU render (${round2(renderCpuMs)} ms render vs ${round2(animationCpuMs)} ms anim)`;
  }
  return `Within budget (${round2(cpuTotalMs)} ms CPU${gpuFrameMs !== null ? `, ${round2(gpuFrameMs)} ms GPU` : ""})`;
}
