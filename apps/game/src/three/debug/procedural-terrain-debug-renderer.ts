import { createMapSheetFixture, type MapChapter } from "@/lab/sheet-map/fixture";
import { MapSheetPresentation } from "@/lab/sheet-map/presentation";
import { EndgameFixtureScene } from "@/lab/endgame-mist/fixture-scene";
import { createEndgameFixture } from "@/lab/endgame-mist/fixture";
import type { EndgameLabSettings } from "@/lab/endgame-mist/fixture";
import type { GameModeId } from "@/config/game-modes";
import { createPipelineCompiler, type PipelineCompiler } from "@/three/pipeline-compiler";
import { WeatherLabRuntime } from "./weather-lab-runtime";
import { resetGameEnd } from "@/three/effects/endgame/state";
import { GameMapMaterialLibrary } from "@/three/effects/game-map-material-library";
import { WeatherType } from "../managers/weather-manager";
import { configureWorldSunShadows } from "@/three/effects/world-sun-shadows";
import { configureRendererColorOutput } from "@/three/renderer-color-output";
import { WorldAtmosphereController } from "@/three/effects/world-atmosphere-controller";
import { createLocalTerrainLabRequest } from "./local-terrain-lab";
import { StructureType } from "@bibliothecadao/types";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  Fog,
  PCFShadowMap,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { resolveWebGpuRendererActiveMode } from "@/three/webgpu-renderer-backend";
import { WebGPURenderer } from "three/webgpu";

import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { getStructureModelPaths } from "@/three/constants/scene-constants";
import InstancedModel from "@/three/managers/instanced-model";
import { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { TerrainQualityTier } from "@/three/terrain/terrain-quality";
import type { PreparedTerrainPage, TerrainPageRequest } from "@/three/terrain/terrain-types";
import { TERRAIN_SHALLOW_WATER_DEPTH } from "@/three/terrain/terrain-water";
import type { TerrainMovementInteraction } from "@/three/terrain/terrain-movement-effects";
import {
  createTerrainRevealVerificationRequest,
  createTerrainVerificationRequest,
  TERRAIN_REVEAL_TARGET,
  TERRAIN_SETTLEMENT_REGROWTH_SITES,
  type TerrainVerificationSceneId,
} from "@/three/terrain/verification/terrain-verification-fixtures";
import { TERRAIN_FOG_REVEAL_DURATION_SECONDS } from "@/three/terrain/terrain-fog-field";
import { measureTerrainEcologyTransects } from "@/three/terrain/verification/terrain-ecology-transects";
import { TERRAIN_DEEP_FOG_COLOR, TERRAIN_DEEP_FOG_OPACITY } from "@/three/terrain/terrain-fog-style";
import { configureGltfTextureSupport, gltfLoader } from "@/three/utils/utils";

import { TerrainLabInteraction } from "./terrain-lab-interaction";
import { DEFAULT_TERRAIN_LAB_PREVIEW, type TerrainLabPreview } from "./terrain-lab-preview";

const LAB_LIGHTING_OPTIONS = {
  world: { snap: true, environment: "world" },
  ethereal: { snap: true, environment: "ethereal" },
} as const;

export interface ProceduralTerrainDebugStats {
  endgame?: ReturnType<EndgameFixtureScene["getSnapshot"]> & {
    renderSubmissionP50Ms: number;
    renderSubmissionP95Ms: number;
    renderSubmissionSamples: number;
    rendererTriangles: number;
  };
  gameMode: GameModeId;
  activeMode: "webgl2-fallback" | "webgpu";
  biomeCount: number;
  buildingInstances: number;
  cellCount: number;
  commitMs: number;
  drawCalls: number;
  dustActiveParticles: number;
  dustCapacity: number;
  dustEmitterCount: number;
  dustTriangles: number;
  fingerprint: string;
  firstRenderMs: number;
  fogMaskBytes: number;
  fogMaskHeight: number;
  fogMaskWidth: number;
  fogOpacity: number;
  fogTerrainCells: number;
  preparedFrontierCells: number;
  wildlife: ReturnType<ProceduralTerrain["getWildlifeStats"]>;
  frameP50Ms: number;
  frameP95Ms: number;
  frameWorstMs: number;
  frameSampleCount: number;
  groundTextureBytes: number;
  groundTextureLayers: number;
  groundCoverInstances: number;
  prepareMs: number;
  propInstances: number;
  qualityTier: TerrainQualityTier;
  realmInstances: number;
  revealProgress: number;
  roadSegments: number;
  roadCoreDisturbance: number;
  roadNaturalDisturbance: number;
  roadVergeSuccession: number;
  sceneId: TerrainVerificationSceneId;
  settlementSites: number;
  settlementCoreDisturbance: number;
  settlementEdgeSuccession: number;
  settlementOuterMaturity: number;
  settlementTierCount: number;
  shroudActiveReveals: number;
  shroudFrontierInstances: number;
  shroudInstances: number;
  shroudTriangles: number;
  shadingMode: "flat" | "textured";
  triangles: number;
  textures: number;
  vertices: number;
  waterDepthMax: number;
  waterDepthMin: number;
  waterFoamVertices: number;
  waterInteractionInstances: number;
  waterInteractionTriangles: number;
  waterWakeInstances: number;
  wetlandEdgeStrength: number;
  wetlandInteriorStrength: number;
  waterShorelineVertices: number;
  waterTriangles: number;
  waterVertices: number;
}

/**
 * A lab's own world on this renderer's land, light and weather: the land it asks for, and what it places and plays on
 * it each frame. It owns the land once given, so the terrain lab's tile picking stays off.
 */
export interface LabStage {
  readonly request: TerrainPageRequest;
  prepare(context: LabStageContext): Promise<void>;
  /** Advances by the world clock: a slowed world slows everything the stage plays. */
  update(delta: number): void;
  dispose(): void;
}

export interface LabStageContext {
  scene: Scene;
  terrain: ProceduralTerrain;
  camera: PerspectiveCamera;
  controls: MapControls;
  compile: PipelineCompiler;
}

/** How fast the world runs: `scale` slows or speeds it; `fixedStep` advances every frame by 1/60 s, whatever it took. */
export interface LabClock {
  scale: number;
  fixedStep: boolean;
}

export interface ProceduralTerrainDebugRendererHandle {
  dispose(): void;
  getStats(): ProceduralTerrainDebugStats;
  resetCamera(): void;
  focusSelection(): void;
  previewExploration(entryEdge: number): Promise<void>;
  placeBuilding(
    path: string,
    yaw: number,
    hyperstructureId?: number,
    constructionProgress?: number,
    dormant?: boolean,
  ): Promise<void>;
  removeBuilding(clearAll?: boolean): Promise<void>;
  setPreview(preview: TerrainLabPreview): Promise<void>;
  setCycleProgress(progress: number): void;
  playEndgame(): void;
  resetEndgame(): void;
  skipEndgame(): void;
  focusEndgameSpire(): void;
  setMoonEnabled(enabled: boolean): void;
  setClock(clock: LabClock): void;
  setWeather(type: WeatherType): void;
  setWeatherEvolving(enabled: boolean): void;
  strike(): void;
}

interface MountProceduralTerrainDebugRendererInput {
  mapSheet?: { chapter: MapChapter; overlay: HTMLDivElement };
  endgame?: EndgameLabSettings;
  stage?: LabStage;
  gameMode?: GameModeId;
  canvas: HTMLCanvasElement;
  captureMode: boolean;
  localRadius?: number;
  forceWebGL: boolean;
  qualityTier: TerrainQualityTier;
  revealProgress: number;
  sceneId: TerrainVerificationSceneId;
  texturedGround: boolean;
  onError(error: unknown): void;
  onReady(stats: ProceduralTerrainDebugStats): void;
}

interface TerrainDebugRendererSurface extends RendererSurfaceLike {
  library: GameMapMaterialLibrary;
  init(): Promise<void>;
  setAnimationLoop(callback: ((time: number) => void) | null): void;
  setClearColor(color: Color, alpha?: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  /** three's renderer lets go of its GPU device asynchronously. */
  dispose(): Promise<void>;
}

type TerrainDebugRendererConstructor = new (options: {
  antialias: boolean;
  canvas: HTMLCanvasElement;
  forceWebGL: boolean;
}) => TerrainDebugRendererSurface;

interface TerrainDebugRuntime {
  mapSheet: MapSheetPresentation | null;
  endgame: EndgameFixtureScene | null;
  stage: LabStage | null;
  clock: LabClock;
  renderSubmissionMs: number[];
  gameMode: GameModeId;
  atmosphere: WorldAtmosphereController;
  weather: WeatherLabRuntime;
  cycleProgress: number;
  camera: PerspectiveCamera;
  cameraFrame: TerrainDebugCameraFrame;
  controls: MapControls;
  interaction: TerrainLabInteraction | null;
  firstRenderMs: number;
  frameSamplesMs: number[];
  renderer: TerrainDebugRendererSurface;
  realmModel: InstancedModel | null;
  scene: Scene;
  terrain: ProceduralTerrain;
}

interface TerrainDebugCameraFrame {
  position: Vector3;
  target: Vector3;
}

type TerrainVerificationWindow = Window & {
  __terrainVerification?: {
    error?: string;
    getSnapshot?: () => ProceduralTerrainDebugStats;
    getInteraction?: () => ReturnType<TerrainLabInteraction["getState"]>;
    status: "booting" | "error" | "ready";
    version: 1;
  };
};

const CAMERA_DIRECTION = new Vector3(0.24, 0.62, 0.75).normalize();
const CAMERA_FRAME_PADDING = 0.72;

/** Each canvas's turn: settled once the renderer last mounted on it has let go of its GPU device. */
const canvasTurns = new WeakMap<HTMLCanvasElement, Promise<void>>();

/**
 * Mounts the lab's renderer on a canvas, one at a time: a mount waits until the one before on the same canvas is
 * disposed. React's StrictMode mounts a view twice in development; the first renderer, still building when its view
 * was cancelled, finished and was disposed while the second drew, and a canvas shared by two GPU devices refused every
 * later frame (a black map).
 */
export async function mountProceduralTerrainDebugRenderer(
  input: MountProceduralTerrainDebugRendererInput,
): Promise<ProceduralTerrainDebugRendererHandle> {
  const previous = canvasTurns.get(input.canvas) ?? Promise.resolve();
  let release: () => void = () => {};
  canvasTurns.set(
    input.canvas,
    previous.then(() => new Promise<void>((resolve) => (release = resolve))),
  );
  await previous;
  try {
    return await mountOnCanvas(input, () => release());
  } catch (error) {
    release();
    throw error;
  }
}

async function mountOnCanvas(
  input: MountProceduralTerrainDebugRendererInput,
  released: () => void,
): Promise<ProceduralTerrainDebugRendererHandle> {
  const debugWindow = window as TerrainVerificationWindow;
  const verification: NonNullable<TerrainVerificationWindow["__terrainVerification"]> = {
    status: "booting",
    version: 1,
  };
  debugWindow.__terrainVerification = verification;

  try {
    const runtime = await createRuntime(input);
    const resizeObserver = observeCanvas(input.canvas, runtime);
    const stopAnimation = startAnimation(runtime, input);
    const stats = readStats(runtime, input.forceWebGL, input.texturedGround);
    Object.assign(verification, {
      getSnapshot: () => readStats(runtime, input.forceWebGL, input.texturedGround),
      getInteraction: () => runtime.interaction?.getState(),
      status: "ready",
      version: 1,
    });
    input.onReady(stats);

    return {
      dispose: () => {
        stopAnimation();
        resizeObserver.disconnect();
        runtime.controls.dispose();
        runtime.interaction?.dispose();
        runtime.mapSheet?.dispose();
        runtime.endgame?.dispose();
        runtime.stage?.dispose();
        runtime.realmModel?.dispose();
        runtime.terrain.dispose();
        runtime.weather.dispose();
        runtime.atmosphere.dispose();
        void runtime.renderer.dispose().finally(released);
        if (debugWindow.__terrainVerification === verification) {
          resetGameEnd();
          delete debugWindow.__terrainVerification;
        }
      },
      getStats: () => readStats(runtime, input.forceWebGL, input.texturedGround),
      resetCamera: () => positionCamera(runtime.camera, runtime.controls, runtime.cameraFrame),
      previewExploration: async (entryEdge) => runtime.interaction?.previewExploration(entryEdge),
      placeBuilding: async (path, yaw, id, progress, dormant) =>
        runtime.interaction?.placeBuilding(path, yaw, id, progress, dormant),
      removeBuilding: async (clearAll) => runtime.interaction?.removeBuilding(clearAll),
      setPreview: async (preview) => runtime.interaction?.configure(preview),
      setWeatherEvolving: (enabled) => runtime.weather.setEvolving(enabled),
      playEndgame: () => runtime.endgame?.play(),
      resetEndgame: () => runtime.endgame?.reset(),
      skipEndgame: () => runtime.endgame?.skip(),
      focusEndgameSpire: () => {
        const origin = runtime.endgame?.getSnapshot().orbOrigins?.[0];
        if (!origin) return;
        runtime.controls.target.set(origin.x, origin.y, origin.z);
        runtime.camera.position.set(origin.x + 3.2, origin.y + 3.5, origin.z + 5);
        runtime.camera.lookAt(runtime.controls.target);
        runtime.controls.update();
      },
      setWeather: (type) => runtime.weather.setWeather(type),
      strike: () => runtime.weather.strike(),
      setMoonEnabled: (enabled) => {
        runtime.atmosphere.params.moonEnabled = enabled;
      },
      setClock: (clock) => {
        runtime.clock = clock;
      },
      setCycleProgress: (progress) => {
        runtime.cycleProgress = progress;
      },
      focusSelection: () => {
        const target = runtime.interaction?.getSelectedPosition();
        if (!target) return;
        positionCamera(runtime.camera, runtime.controls, {
          target,
          position: target.clone().addScaledVector(CAMERA_DIRECTION, 8),
        });
      },
    };
  } catch (error) {
    Object.assign(verification, {
      error: error instanceof Error ? error.message : String(error),
      status: "error",
      version: 1,
    });
    throw error;
  }
}

async function createRuntime(input: MountProceduralTerrainDebugRendererInput): Promise<TerrainDebugRuntime> {
  resetGameEnd();
  const Renderer = WebGPURenderer as unknown as TerrainDebugRendererConstructor;
  const renderer = new Renderer({ canvas: input.canvas, antialias: true, forceWebGL: input.forceWebGL });
  const endgame = input.endgame ? new EndgameFixtureScene(input.endgame) : null;
  renderer.library = new GameMapMaterialLibrary();
  const background = new Color(TERRAIN_DEEP_FOG_COLOR);
  configureRendererColorOutput(renderer);
  renderer.setPixelRatio(1);
  // Sized to its canvas before any pass is compiled or drawn: a first frame at the canvas's default 300 × 150 left a
  // depth buffer that never matched the resized frame, and every later frame was refused (a black map).
  const [width, height] = canvasSize(input.canvas);
  renderer.setSize(width, height, false);
  renderer.setClearColor(background, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  await renderer.init();
  configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);

  const scene = new Scene();
  scene.background = background;
  let request = input.mapSheet
    ? createMapSheetFixture(input.mapSheet.chapter)
    : input.endgame
      ? createEndgameFixture(input.endgame).request
      : input.stage
        ? input.stage.request
        : input.localRadius === undefined
          ? createTerrainVerificationRequest(input.sceneId)
          : createLocalTerrainLabRequest(input.localRadius);
  const camera = new PerspectiveCamera(36, width / height, 0.1, 300);
  const controls = new MapControls(camera, input.canvas);
  controls.enableDamping = false;
  controls.enabled = !input.captureMode;
  controls.maxPolarAngle = Math.PI / 2.05;
  const cameraFrame = createCameraFrame(camera, request.cells);
  positionCamera(camera, controls, cameraFrame);

  const terrain = new ProceduralTerrain({ streaming: true, gameMode: input.gameMode });
  await Promise.all([terrain.loadProps(), terrain.loadGroundTextures()]);
  terrain.setQualityTier(input.qualityTier);
  let prepared = await terrain.preparePageAsync(request);
  let fogMask = await terrain.prepareFogMaskAsync([prepared]);
  let commitStartedAt = performance.now();
  terrain.present([prepared], fogMask);
  let commitMs = performance.now() - commitStartedAt;
  terrain.setMovementInteractions(createMovementInteractionVerification(input.sceneId, terrain));
  await terrain.loadWildlife();
  terrain.update(0);
  if (input.sceneId === "fog-reveal" && input.revealProgress > 0) {
    terrain.queueShroudReveal(TERRAIN_REVEAL_TARGET.col, TERRAIN_REVEAL_TARGET.row);
    request = createTerrainRevealVerificationRequest(true);
    prepared = await terrain.preparePageAsync(request);
    fogMask = await terrain.prepareFogMaskAsync([prepared]);
    commitStartedAt = performance.now();
    terrain.present([prepared], fogMask);
    commitMs = Math.max(commitMs, performance.now() - commitStartedAt);
    advanceRevealToProgress(terrain, input.revealProgress);
  }
  const propStats = terrain.getPropStats();
  const shroudStats = terrain.getShroudStats();
  const groundTextureStats = terrain.getGroundTextureStats();
  const realmModel = await createSettlementRealmModel(input.sceneId, terrain);
  const realmGeometry = measureInstancedModelGeometry(realmModel);
  const ecologyTransects = measureTerrainEcologyTransects(request);
  const waterGeometry = measureWaterGeometry(prepared.waterBuffers);
  const movementInteractionStats = terrain.getMovementInteractionStats();
  terrain.object3d.userData.verification = {
    biomeCount: new Set(prepared.request.cells.map(({ biome }) => biome).filter(Boolean)).size,
    buildingInstances: 0,
    cellCount: prepared.request.cells.length,
    commitMs,
    fingerprint: prepared.fingerprint,
    wildlife: terrain.getWildlifeStats(),
    fogOpacity: TERRAIN_DEEP_FOG_OPACITY,
    fogTerrainCells: prepared.diagnostics.fogTerrainCells,
    preparedFrontierCells: countPreparedFrontierCells(prepared),
    fogMaskBytes: shroudStats.maskBytes,
    fogMaskHeight: shroudStats.maskHeight,
    fogMaskWidth: shroudStats.maskWidth,
    groundTextureBytes: groundTextureStats.bytes,
    groundTextureLayers: groundTextureStats.layerCount,
    groundCoverInstances: propStats.groundCoverInstances,
    prepareMs: prepared.diagnostics.prepareMs,
    propInstances: propStats.instances,
    qualityTier: input.qualityTier,
    realmInstances: realmModel?.getCount() ?? 0,
    revealProgress: input.revealProgress,
    roadSegments: prepared.diagnostics.roadSegments,
    sceneId: input.sceneId,
    settlementSites: prepared.diagnostics.settlementSites,
    shroudActiveReveals: shroudStats.activeReveals,
    shroudFrontierInstances: shroudStats.frontierInstances,
    shroudInstances: shroudStats.instances,
    shroudTriangles: shroudStats.triangles,
    triangles:
      prepared.diagnostics.triangles +
      propStats.triangles +
      shroudStats.triangles +
      realmGeometry.triangles +
      movementInteractionStats.triangles,
    vertices: prepared.diagnostics.vertices + realmGeometry.vertices,
    dustActiveParticles: movementInteractionStats.dust.activeParticles,
    dustCapacity: movementInteractionStats.dust.capacity,
    dustEmitterCount: movementInteractionStats.dust.emitters,
    dustTriangles: movementInteractionStats.dust.triangles,
    waterInteractionInstances: movementInteractionStats.water.instances,
    waterInteractionTriangles: movementInteractionStats.water.triangles,
    waterWakeInstances: movementInteractionStats.water.wakes,
    ...waterGeometry,
    ...ecologyTransects,
  } satisfies Omit<
    ProceduralTerrainDebugStats,
    | "gameMode"
    | "activeMode"
    | "drawCalls"
    | "firstRenderMs"
    | "frameP50Ms"
    | "frameP95Ms"
    | "frameWorstMs"
    | "frameSampleCount"
    | "shadingMode"
    | "textures"
  >;
  scene.add(terrain.object3d);
  if (realmModel) scene.add(realmModel.group);
  const { atmosphere, sun } = createGameLighting(scene, input.gameMode);
  const weather = new WeatherLabRuntime(scene, sun, controls, (x, z) => terrain.sampleSurface(x, z).height);
  atmosphere.update(50, controls.target, { snap: true });
  terrain.setGroundTextureDetailEnabled(input.texturedGround);
  if (endgame || input.stage) {
    const compile = createPipelineCompiler({ getRenderer: () => renderer, getCamera: () => camera });
    try {
      await endgame?.prepare(scene, terrain, camera, compile);
      await input.stage?.prepare({ scene, terrain, camera, controls, compile });
    } catch (error) {
      endgame?.dispose();
      input.stage?.dispose();
      terrain.dispose();
      weather.dispose();
      atmosphere.dispose();
      controls.dispose();
      realmModel?.dispose();
      await renderer.dispose();
      throw error;
    }
  }
  const mapSheet = input.mapSheet
    ? new MapSheetPresentation(scene, terrain, input.mapSheet.chapter, input.mapSheet.overlay)
    : null;
  const firstRenderStartedAt = performance.now();
  renderer.render(scene, camera);
  const firstRenderMs = performance.now() - firstRenderStartedAt;

  const interaction = input.stage
    ? null
    : new TerrainLabInteraction(
        input.canvas,
        camera,
        scene,
        terrain,
        request,
        input.onError,
        (page, duration) => updateTerrainVerification(terrain, page, duration, realmGeometry),
        createPipelineCompiler({ getRenderer: () => renderer, getCamera: () => camera }),
        input.localRadius !== undefined,
      );
  if (input.mapSheet) await interaction?.configure({ ...DEFAULT_TERRAIN_LAB_PREVIEW, selection: false });
  return {
    mapSheet,
    endgame,
    stage: input.stage ?? null,
    clock: { scale: 1, fixedStep: false },
    renderSubmissionMs: [],
    atmosphere,
    weather,
    cycleProgress: 50,
    gameMode: input.gameMode ?? "blitz",
    interaction,
    camera,
    cameraFrame,
    controls,
    frameSamplesMs: [],
    realmModel,
    renderer,
    scene,
    terrain,
    firstRenderMs,
  };
}

function updateTerrainVerification(
  terrain: ProceduralTerrain,
  prepared: PreparedTerrainPage,
  commitMs: number,
  realmGeometry: { triangles: number; vertices: number },
): void {
  const props = terrain.getPropStats();
  const shroud = terrain.getShroudStats();
  const movement = terrain.getMovementInteractionStats();
  Object.assign(terrain.object3d.userData.verification, {
    fingerprint: prepared.fingerprint,
    biomeCount: new Set(prepared.request.cells.map((cell) => cell.biome).filter(Boolean)).size,
    prepareMs: prepared.diagnostics.prepareMs,
    commitMs,
    fogTerrainCells: prepared.diagnostics.fogTerrainCells,
    preparedFrontierCells: countPreparedFrontierCells(prepared),
    groundCoverInstances: props.groundCoverInstances,
    settlementSites: prepared.request.settlementAnchors.length,
    triangles:
      prepared.diagnostics.triangles +
      props.triangles +
      shroud.triangles +
      realmGeometry.triangles +
      movement.triangles,
    vertices: prepared.diagnostics.vertices + realmGeometry.vertices,
    ...measureWaterGeometry(prepared.waterBuffers),
    ...measureTerrainEcologyTransects(prepared.request),
  });
}

function createMovementInteractionVerification(
  sceneId: TerrainVerificationSceneId,
  terrain: ProceduralTerrain,
): TerrainMovementInteraction[] {
  if (sceneId === "tropical-coast") {
    return [
      createMovementInteraction(101, 1, 3, true, "naval", Math.PI / 5, terrain),
      createMovementInteraction(202, 3, 6, true, "naval", -Math.PI / 3, terrain),
      createMovementInteraction(303, 2, 9, false, "naval", 0, terrain),
    ];
  }
  if (sceneId === "settlement-regrowth") {
    return TERRAIN_SETTLEMENT_REGROWTH_SITES.map(({ col, row }, index) =>
      createMovementInteraction(401 + index, col, row, true, "ground", (index * Math.PI) / 3, terrain),
    );
  }
  return [];
}

function createMovementInteraction(
  entityId: number,
  col: number,
  row: number,
  isMoving: boolean,
  mode: TerrainMovementInteraction["mode"],
  yaw: number,
  terrain: ProceduralTerrain,
): TerrainMovementInteraction {
  const center = terrainHexToWorld(col, row);
  return {
    entityId,
    isMoving,
    mode,
    worldX: center.x,
    worldY: terrain.sampleSurface(center.x, center.z).height,
    worldZ: center.z,
    yaw,
  };
}

async function createSettlementRealmModel(
  sceneId: TerrainVerificationSceneId,
  terrain: ProceduralTerrain,
): Promise<InstancedModel | null> {
  if (sceneId !== "settlement-regrowth") return null;
  const realmPath = getStructureModelPaths()[StructureType.Realm][0];
  const gltf = await gltfLoader.loadAsync(realmPath);
  const model = new InstancedModel(gltf, TERRAIN_SETTLEMENT_REGROWTH_SITES.length, false, "Realm");
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const scale = new Vector3(1, 1, 1);
  const up = new Vector3(0, 1, 0);

  TERRAIN_SETTLEMENT_REGROWTH_SITES.forEach(({ col, row }, index) => {
    const center = terrainHexToWorld(col, row);
    const position = new Vector3(center.x, terrain.sampleSurface(center.x, center.z).height + 0.05, center.z);
    quaternion.setFromAxisAngle(up, (index * Math.PI * 2) / TERRAIN_SETTLEMENT_REGROWTH_SITES.length);
    matrix.compose(position, quaternion, scale);
    model.setMatrixAt(index, matrix);
  });
  model.setCount(TERRAIN_SETTLEMENT_REGROWTH_SITES.length);
  model.needsUpdate();
  return model;
}

function measureInstancedModelGeometry(model: InstancedModel | null): { triangles: number; vertices: number } {
  let triangles = 0;
  let vertices = 0;
  model?.group.traverse((object) => {
    if (!(object instanceof InstancedMesh)) return;
    const positionCount = object.geometry.getAttribute("position")?.count ?? 0;
    const triangleCount = (object.geometry.index?.count ?? positionCount) / 3;
    triangles += triangleCount * object.count;
    vertices += positionCount * object.count;
  });
  return { triangles, vertices };
}

function measureWaterGeometry(
  buffers: PreparedTerrainPage["waterBuffers"],
): Pick<
  ProceduralTerrainDebugStats,
  | "waterDepthMax"
  | "waterDepthMin"
  | "waterFoamVertices"
  | "waterShorelineVertices"
  | "waterTriangles"
  | "waterVertices"
> {
  if (!buffers || buffers.waterDepth.length === 0) {
    return {
      waterDepthMax: 0,
      waterDepthMin: 0,
      waterFoamVertices: 0,
      waterShorelineVertices: 0,
      waterTriangles: 0,
      waterVertices: 0,
    };
  }
  return {
    waterDepthMax: Math.max(...buffers.waterDepth),
    waterDepthMin: Math.min(...buffers.waterDepth),
    waterFoamVertices: Array.from(buffers.waterDepth).filter(
      (depth, index) => depth <= TERRAIN_SHALLOW_WATER_DEPTH && buffers.shore[index] > 0.35,
    ).length,
    waterShorelineVertices: Array.from(buffers.waterDepth).filter((depth) => depth <= 0.002_001).length,
    waterTriangles: buffers.indices.length / 3,
    waterVertices: buffers.positions.length / 3,
  };
}

function advanceRevealToProgress(terrain: ProceduralTerrain, progress: number): void {
  const targetSeconds = Math.min(1, Math.max(0, progress)) * TERRAIN_FOG_REVEAL_DURATION_SECONDS;
  const steps = Math.ceil(targetSeconds / 0.05);
  for (let step = 0; step < steps; step += 1) terrain.update(Math.min(0.05, targetSeconds - step * 0.05));
}

function createGameLighting(
  scene: Scene,
  gameMode: GameModeId = "blitz",
): { atmosphere: WorldAtmosphereController; sun: DirectionalLight } {
  const ambient = new AmbientLight();
  const hemisphere = new HemisphereLight();
  const sun = new DirectionalLight();
  configureWorldSunShadows(sun, true, 2048);
  scene.add(ambient, hemisphere, sun, sun.target);
  // The game controller also uses this detached fog object for atmosphere colors.
  // Exploration coverage belongs to TerrainFogField, not Three.js distance fog.
  return {
    atmosphere: new WorldAtmosphereController(
      scene,
      sun,
      hemisphere,
      ambient,
      new Fog(TERRAIN_DEEP_FOG_COLOR),
      gameMode,
    ),
    sun,
  };
}

function createCameraFrame(
  camera: PerspectiveCamera,
  cells: ReadonlyArray<{ col: number; row: number }>,
): TerrainDebugCameraFrame {
  const centers = cells.map(({ col, row }) => terrainHexToWorld(col, row));
  const minX = Math.min(...centers.map(({ x }) => x)) - 1;
  const maxX = Math.max(...centers.map(({ x }) => x)) + 1;
  const minZ = Math.min(...centers.map(({ z }) => z)) - 1;
  const maxZ = Math.max(...centers.map(({ z }) => z)) + 1;
  const target = new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const radius = Math.hypot((maxX - minX) / 2, (maxZ - minZ) / 2);
  const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * CAMERA_FRAME_PADDING;
  return { position: target.clone().addScaledVector(CAMERA_DIRECTION, distance), target };
}

function positionCamera(camera: PerspectiveCamera, controls: MapControls, frame: TerrainDebugCameraFrame): void {
  camera.position.copy(frame.position);
  controls.target.copy(frame.target);
  camera.lookAt(controls.target);
  controls.update();
}

function observeCanvas(canvas: HTMLCanvasElement, runtime: TerrainDebugRuntime): ResizeObserver {
  const observer = new ResizeObserver(() => resizeRenderer(canvas, runtime));
  observer.observe(canvas);
  resizeRenderer(canvas, runtime);
  return observer;
}

/** The canvas's size on its page, in whole pixels. */
function canvasSize(canvas: HTMLCanvasElement): [width: number, height: number] {
  const bounds = canvas.getBoundingClientRect();
  return [Math.max(1, Math.floor(bounds.width)), Math.max(1, Math.floor(bounds.height))];
}

function resizeRenderer(canvas: HTMLCanvasElement, runtime: TerrainDebugRuntime): void {
  const [width, height] = canvasSize(canvas);
  // The canvas takes its size from its page; writing it back inline would pin it and hide every later resize.
  runtime.renderer.setSize(width, height, false);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
  if (runtime.mapSheet) {
    runtime.mapSheet.frame(runtime.camera, width / height);
    runtime.controls.target.copy(runtime.mapSheet.target);
  }
}

function startAnimation(runtime: TerrainDebugRuntime, input: MountProceduralTerrainDebugRendererInput): () => void {
  let previousFrameTime: number | null = null;
  runtime.renderer.setAnimationLoop((time) => {
    if (previousFrameTime !== null) {
      runtime.frameSamplesMs.push(time - previousFrameTime);
      if (runtime.frameSamplesMs.length > 240) runtime.frameSamplesMs.shift();
    }
    previousFrameTime = time;
    const frameSeconds = runtime.clock.fixedStep
      ? 1 / 60
      : Math.min(0.05, Math.max(0, (runtime.frameSamplesMs.at(-1) ?? 0) / 1_000));
    const deltaSeconds = input.captureMode && input.sceneId === "fog-reveal" ? 0 : frameSeconds * runtime.clock.scale;
    const endgameFrozen = runtime.endgame?.getSnapshot().finished === true;
    runtime.controls.update();
    runtime.atmosphere.update(runtime.cycleProgress, runtime.controls.target, {
      ...LAB_LIGHTING_OPTIONS[runtime.terrain.getSurfacePresentation()],
      etherealDepth: runtime.terrain.getEtherealDepth(),
    });
    runtime.endgame?.update(Math.max(0, (runtime.frameSamplesMs.at(-1) ?? 0) / 1000), runtime.terrain, runtime.camera);
    if (!endgameFrozen) {
      runtime.terrain.update(deltaSeconds);
      runtime.weather.update(deltaSeconds, runtime.atmosphere);
      runtime.interaction?.update(deltaSeconds, runtime.weather.getWind());
      runtime.stage?.update(deltaSeconds);
    }
    runtime.mapSheet?.update(deltaSeconds, runtime.camera, input.canvas.clientWidth, input.canvas.clientHeight);
    const submittedAt = performance.now();
    runtime.renderer.render(runtime.scene, runtime.camera);
    runtime.renderSubmissionMs.push(performance.now() - submittedAt);
    if (runtime.renderSubmissionMs.length > 240) runtime.renderSubmissionMs.shift();
  });
  return () => runtime.renderer.setAnimationLoop(null);
}

function readStats(
  runtime: TerrainDebugRuntime,
  forceWebGL: boolean,
  texturedGround = runtime.terrain.isGroundTextureDetailEnabled(),
): ProceduralTerrainDebugStats {
  const verification = runtime.terrain.object3d.userData.verification as Omit<
    ProceduralTerrainDebugStats,
    "activeMode" | "drawCalls"
  >;
  return {
    ...verification,
    ...(runtime.endgame
      ? {
          endgame: {
            ...runtime.endgame.getSnapshot(),
            renderSubmissionP50Ms: percentile(runtime.renderSubmissionMs, 0.5),
            renderSubmissionP95Ms: percentile(runtime.renderSubmissionMs, 0.95),
            renderSubmissionSamples: runtime.renderSubmissionMs.length,
            rendererTriangles: runtime.renderer.info.render.triangles,
          },
        }
      : {}),
    gameMode: runtime.gameMode,
    wildlife: runtime.terrain.getWildlifeStats(),
    buildingInstances: runtime.interaction?.getState().buildings.length ?? 0,
    propInstances: runtime.terrain.getPropStats().instances,
    fogMaskBytes: runtime.terrain.getShroudStats().maskBytes,
    fogMaskHeight: runtime.terrain.getShroudStats().maskHeight,
    fogMaskWidth: runtime.terrain.getShroudStats().maskWidth,
    shroudFrontierInstances: runtime.terrain.getShroudStats().frontierInstances,
    shroudTriangles: runtime.terrain.getShroudStats().triangles,
    shroudInstances: runtime.terrain.getShroudStats().instances,
    shroudActiveReveals: runtime.terrain.getShroudStats().activeReveals,
    activeMode: resolveWebGpuRendererActiveMode(runtime.renderer),
    drawCalls: runtime.renderer.info.render.drawCalls ?? runtime.renderer.info.render.calls,
    firstRenderMs: runtime.firstRenderMs,
    frameP50Ms: percentile(runtime.frameSamplesMs, 0.5),
    frameP95Ms: percentile(runtime.frameSamplesMs, 0.95),
    frameWorstMs: Math.max(0, ...runtime.frameSamplesMs),
    frameSampleCount: runtime.frameSamplesMs.length,
    shadingMode: texturedGround ? "textured" : "flat",
    textures: runtime.renderer.info.memory.textures,
  };
}

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = values.toSorted((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)];
}

function countPreparedFrontierCells(prepared: PreparedTerrainPage): number {
  return prepared.shroudInstances.filter((instance) => instance.frontier).length;
}
