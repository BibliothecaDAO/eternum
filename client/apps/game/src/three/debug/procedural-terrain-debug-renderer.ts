import { StructureType } from "@bibliothecadao/types";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import WebGPU from "three/addons/capabilities/WebGPU.js";
import { WebGPURenderer } from "three/webgpu";

import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { getStructureModelPaths } from "@/three/constants/scene-constants";
import InstancedModel from "@/three/managers/instanced-model";
import { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { TerrainQualityTier } from "@/three/terrain/terrain-quality";
import type { PreparedTerrainPage } from "@/three/terrain/terrain-types";
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

export interface ProceduralTerrainDebugStats {
  activeMode: "webgl2-fallback" | "webgpu";
  biomeCount: number;
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
  frontierPreviewCells: number;
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

export interface ProceduralTerrainDebugRendererHandle {
  dispose(): void;
  getStats(): ProceduralTerrainDebugStats;
  resetCamera(): void;
}

interface MountProceduralTerrainDebugRendererInput {
  canvas: HTMLCanvasElement;
  captureMode: boolean;
  forceWebGL: boolean;
  qualityTier: TerrainQualityTier;
  revealProgress: number;
  sceneId: TerrainVerificationSceneId;
  texturedGround: boolean;
  onReady(stats: ProceduralTerrainDebugStats): void;
}

interface TerrainDebugRendererSurface extends RendererSurfaceLike {
  init(): Promise<void>;
  setAnimationLoop(callback: ((time: number) => void) | null): void;
  setClearColor(color: Color, alpha?: number): void;
}

type TerrainDebugRendererConstructor = new (options: {
  antialias: boolean;
  canvas: HTMLCanvasElement;
  forceWebGL: boolean;
}) => TerrainDebugRendererSurface;

interface TerrainDebugRuntime {
  camera: PerspectiveCamera;
  cameraFrame: TerrainDebugCameraFrame;
  controls: MapControls;
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
    status: "booting" | "error" | "ready";
    version: 1;
  };
};

const CAMERA_DIRECTION = new Vector3(0.24, 0.62, 0.75).normalize();
const CAMERA_FRAME_PADDING = 0.72;

export async function mountProceduralTerrainDebugRenderer(
  input: MountProceduralTerrainDebugRendererInput,
): Promise<ProceduralTerrainDebugRendererHandle> {
  const debugWindow = window as TerrainVerificationWindow;
  debugWindow.__terrainVerification = { status: "booting", version: 1 };

  try {
    const runtime = await createRuntime(input);
    const resizeObserver = observeCanvas(input.canvas, runtime);
    const stopAnimation = startAnimation(runtime);
    const stats = readStats(runtime, input.forceWebGL, input.texturedGround);
    debugWindow.__terrainVerification = {
      getSnapshot: () => readStats(runtime, input.forceWebGL, input.texturedGround),
      status: "ready",
      version: 1,
    };
    input.onReady(stats);

    return {
      dispose: () => {
        stopAnimation();
        resizeObserver.disconnect();
        runtime.controls.dispose();
        runtime.realmModel?.dispose();
        runtime.terrain.dispose();
        runtime.renderer.dispose();
        delete debugWindow.__terrainVerification;
      },
      getStats: () => readStats(runtime, input.forceWebGL, input.texturedGround),
      resetCamera: () => positionCamera(runtime.camera, runtime.controls, runtime.cameraFrame),
    };
  } catch (error) {
    debugWindow.__terrainVerification = {
      error: error instanceof Error ? error.message : String(error),
      status: "error",
      version: 1,
    };
    throw error;
  }
}

async function createRuntime(input: MountProceduralTerrainDebugRendererInput): Promise<TerrainDebugRuntime> {
  const Renderer = WebGPURenderer as unknown as TerrainDebugRendererConstructor;
  const renderer = new Renderer({ canvas: input.canvas, antialias: true, forceWebGL: input.forceWebGL });
  const background = new Color(input.sceneId.startsWith("fog-") ? TERRAIN_DEEP_FOG_COLOR : "#d8d0ba");
  renderer.outputColorSpace = "srgb";
  renderer.setPixelRatio(1);
  renderer.setClearColor(background, 1);
  renderer.shadowMap.enabled = true;
  await renderer.init();
  configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);

  const scene = new Scene();
  scene.background = background;
  let request = createTerrainVerificationRequest(input.sceneId);
  const camera = new PerspectiveCamera(36, 1, 0.1, 300);
  const controls = new MapControls(camera, input.canvas);
  controls.enableDamping = false;
  controls.enabled = !input.captureMode;
  controls.maxPolarAngle = Math.PI / 2.05;
  const cameraFrame = createCameraFrame(camera, request.cells);
  positionCamera(camera, controls, cameraFrame);

  const terrain = new ProceduralTerrain();
  await Promise.all([terrain.loadProps(), terrain.loadGroundTextures()]);
  terrain.setQualityTier(input.qualityTier);
  let prepared = await terrain.preparePageAsync(request);
  let fogMask = await terrain.prepareFogMaskAsync([prepared]);
  let commitStartedAt = performance.now();
  terrain.present([prepared], fogMask);
  let commitMs = performance.now() - commitStartedAt;
  terrain.setMovementInteractions(createMovementInteractionVerification(input.sceneId, terrain));
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
    cellCount: prepared.request.cells.length,
    commitMs,
    fingerprint: prepared.fingerprint,
    fogOpacity: TERRAIN_DEEP_FOG_OPACITY,
    fogTerrainCells: prepared.diagnostics.fogTerrainCells,
    frontierPreviewCells: prepared.diagnostics.frontierPreviewCells,
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
  scene.add(createLights());
  terrain.setGroundTextureDetailEnabled(input.texturedGround);
  const firstRenderStartedAt = performance.now();
  renderer.render(scene, camera);
  const firstRenderMs = performance.now() - firstRenderStartedAt;

  return { camera, cameraFrame, controls, frameSamplesMs: [], realmModel, renderer, scene, terrain, firstRenderMs };
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
  const realmPath = getStructureModelPaths(false)[StructureType.Realm][0];
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

function createLights(): Group {
  const lights = new Group();
  lights.name = "procedural-terrain-debug-lights";
  lights.add(new AmbientLight(0xdce6df, 1.7));
  const sun = new DirectionalLight(0xffedca, 3.4);
  sun.position.set(7, 11, 8);
  sun.castShadow = true;
  lights.add(sun);
  return lights;
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

function resizeRenderer(canvas: HTMLCanvasElement, runtime: TerrainDebugRuntime): void {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(bounds.width));
  const height = Math.max(1, Math.floor(bounds.height));
  runtime.renderer.setSize(width, height);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
}

function startAnimation(runtime: TerrainDebugRuntime): () => void {
  let previousFrameTime: number | null = null;
  runtime.renderer.setAnimationLoop((time) => {
    if (previousFrameTime !== null) {
      runtime.frameSamplesMs.push(time - previousFrameTime);
      if (runtime.frameSamplesMs.length > 240) runtime.frameSamplesMs.shift();
    }
    previousFrameTime = time;
    runtime.terrain.update(Math.min(0.05, Math.max(0, (runtime.frameSamplesMs.at(-1) ?? 0) / 1_000)));
    runtime.controls.update();
    runtime.renderer.render(runtime.scene, runtime.camera);
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
    activeMode: forceWebGL || !WebGPU.isAvailable() ? "webgl2-fallback" : "webgpu",
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
