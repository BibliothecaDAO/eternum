import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import WebGPU from "three/addons/capabilities/WebGPU.js";
import { WebGPURenderer } from "three/webgpu";

import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { findNearestTerrainHex, terrainCellKey, terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import {
  TERRAIN_BENCHMARK_CONTRACT_VERSION,
  resolveTerrainBenchmarkVariant,
  type TerrainBenchmarkExplorationMode,
  type TerrainBenchmarkPhase,
  type TerrainBenchmarkRunMode,
  type TerrainBenchmarkSnapshot,
  type TerrainBenchmarkTraceMode,
  type TerrainBenchmarkVariant,
} from "@/three/terrain/verification/terrain-benchmark-contract";
import {
  TERRAIN_BENCHMARK_CELL_COLUMNS,
  TERRAIN_BENCHMARK_CELL_ROWS,
  TERRAIN_BENCHMARK_PAGE_COLUMNS,
  TERRAIN_BENCHMARK_PAGE_ROWS,
  TERRAIN_BENCHMARK_PAGE_SIZE,
  TERRAIN_BENCHMARK_WINDOW_COLUMNS,
  TERRAIN_BENCHMARK_WINDOW_ROWS,
  createTerrainBenchmarkFixture,
  createTerrainBenchmarkLifecycleWaypoints,
  createTerrainBenchmarkMotionWaypoints,
  createTerrainBenchmarkWindowInput,
  type TerrainBenchmarkFixture,
  type TerrainBenchmarkPageCoordinate,
} from "@/three/terrain/verification/terrain-benchmark-fixture";
import { TerrainBenchmarkRecorder } from "@/three/terrain/verification/terrain-benchmark-recorder";
import {
  WorldmapProceduralTerrain,
  type WorldmapProceduralPresentationDiagnostics,
  type WorldmapProceduralPresentationInput,
} from "@/three/terrain/worldmap-procedural-terrain";
import { configureGltfTextureSupport } from "@/three/utils/utils";

export interface ProceduralTerrainBenchmarkRendererHandle {
  dispose(): void;
  getSnapshot(): TerrainBenchmarkSnapshot;
  resetCamera(): void;
  startBenchmark(): Promise<TerrainBenchmarkSnapshot>;
}

interface MountProceduralTerrainBenchmarkRendererInput {
  autoRun: boolean;
  canvas: HTMLCanvasElement;
  captureMode: boolean;
  densityMultiplier: number;
  explorationMode: TerrainBenchmarkExplorationMode;
  forceWebGL: boolean;
  onReady(snapshot: TerrainBenchmarkSnapshot): void;
  runMode: TerrainBenchmarkRunMode;
  traceMode: TerrainBenchmarkTraceMode;
  variant: TerrainBenchmarkVariant;
}

interface TerrainBenchmarkRendererSurface extends RendererSurfaceLike {
  getPixelRatio(): number;
  init(): Promise<void>;
  setAnimationLoop(callback: ((time: number) => void) | null): void;
  setClearColor(color: Color, alpha?: number): void;
}

type TerrainBenchmarkRendererConstructor = new (options: {
  antialias: boolean;
  canvas: HTMLCanvasElement;
  forceWebGL: boolean;
}) => TerrainBenchmarkRendererSurface;

interface CameraMotion {
  durationMs: number;
  fromDistance: number;
  fromTarget: Vector3;
  resolve: () => void;
  startedAt: number;
  toDistance: number;
  toTarget: Vector3;
}

interface TerrainBenchmarkRuntime {
  activeCellKeys: Set<string>;
  benchmarkPromise: Promise<TerrainBenchmarkSnapshot> | null;
  camera: PerspectiveCamera;
  cameraDistance: number;
  cameraMotion: CameraMotion | null;
  controls: MapControls;
  disposed: boolean;
  densityMultiplier: number;
  explorationMode: TerrainBenchmarkExplorationMode;
  error: string | null;
  firstRenderMs: number;
  fixture: TerrainBenchmarkFixture;
  forceWebGL: boolean;
  frameWaiters: Array<{ framesRemaining: number; resolve: () => void }>;
  lifecycleGrowth: { geometryGrowth: number; textureGrowth: number };
  longTaskObserver: PerformanceObserver | null;
  maxDrawCalls: number;
  maxTriangles: number;
  phase: TerrainBenchmarkPhase;
  recorder: TerrainBenchmarkRecorder;
  renderer: TerrainBenchmarkRendererSurface;
  runMode: TerrainBenchmarkRunMode;
  scene: Scene;
  status: TerrainBenchmarkSnapshot["status"];
  terrain: WorldmapProceduralTerrain;
  traceMode: TerrainBenchmarkTraceMode;
  variant: TerrainBenchmarkVariant;
}

interface PresentBenchmarkWindowOptions {
  lifecycleVisit?: boolean;
  settleFrames?: boolean;
  verifyCoverage?: boolean;
}

type TerrainBenchmarkWindow = Window & {
  __terrainBenchmark?: {
    error?: string;
    getSnapshot: () => TerrainBenchmarkSnapshot;
    start: () => Promise<TerrainBenchmarkSnapshot>;
    status: TerrainBenchmarkSnapshot["status"];
    version: 1;
  };
};

const CAMERA_DIRECTION = new Vector3(0.22, 0.66, 0.72).normalize();
const CAMERA_DISTANCE = Object.freeze({ close: 27, far: 52, medium: 38 });
const INITIAL_FOCUS = Object.freeze({ col: -1, row: -1 });
const COVERAGE_GRID = Object.freeze([-0.9, -0.45, 0, 0.45, 0.9]);
const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);

export async function mountProceduralTerrainBenchmarkRenderer(
  input: MountProceduralTerrainBenchmarkRendererInput,
): Promise<ProceduralTerrainBenchmarkRendererHandle> {
  const debugWindow = window as TerrainBenchmarkWindow;
  const runtime = await createBenchmarkRuntime(input);
  const resizeObserver = observeCanvas(input.canvas, runtime);
  startAnimation(runtime);
  publishBenchmarkBridge(debugWindow, runtime);
  input.onReady(readBenchmarkSnapshot(runtime));
  if (input.autoRun) queueMicrotask(() => void startBenchmark(runtime));

  return {
    dispose: () => disposeBenchmarkRuntime(debugWindow, runtime, resizeObserver),
    getSnapshot: () => readBenchmarkSnapshot(runtime),
    resetCamera: () => positionCamera(runtime, INITIAL_FOCUS, CAMERA_DISTANCE.medium),
    startBenchmark: () => startBenchmark(runtime),
  };
}

async function createBenchmarkRuntime(
  input: MountProceduralTerrainBenchmarkRendererInput,
): Promise<TerrainBenchmarkRuntime> {
  const renderer = await createRenderer(input);
  const scene = createScene();
  const camera = new PerspectiveCamera(36, 1, 0.1, 500);
  const controls = createControls(camera, input.canvas, input.captureMode || input.autoRun);
  const terrain = new WorldmapProceduralTerrain();
  const fixture = createTerrainBenchmarkFixture();
  const runtime: TerrainBenchmarkRuntime = {
    activeCellKeys: new Set(),
    benchmarkPromise: null,
    camera,
    cameraDistance: CAMERA_DISTANCE.medium,
    cameraMotion: null,
    controls,
    disposed: false,
    densityMultiplier: input.densityMultiplier,
    explorationMode: input.explorationMode,
    error: null,
    firstRenderMs: 0,
    fixture,
    forceWebGL: input.forceWebGL,
    frameWaiters: [],
    lifecycleGrowth: { geometryGrowth: 0, textureGrowth: 0 },
    longTaskObserver: null,
    maxDrawCalls: 0,
    maxTriangles: 0,
    phase: "idle",
    recorder: new TerrainBenchmarkRecorder(),
    renderer,
    runMode: input.runMode,
    scene,
    status: "ready",
    terrain,
    traceMode: input.traceMode,
    variant: input.variant,
  };

  await loadBenchmarkAssets(runtime);
  scene.add(terrain.object3d);
  positionCamera(runtime, INITIAL_FOCUS, CAMERA_DISTANCE.medium);
  await presentBenchmarkWindow(runtime, INITIAL_FOCUS, { settleFrames: false });
  const firstRenderStartedAt = performance.now();
  renderer.render(scene, camera);
  runtime.firstRenderMs = performance.now() - firstRenderStartedAt;
  return runtime;
}

async function createRenderer(
  input: MountProceduralTerrainBenchmarkRendererInput,
): Promise<TerrainBenchmarkRendererSurface> {
  const Renderer = WebGPURenderer as unknown as TerrainBenchmarkRendererConstructor;
  const renderer = new Renderer({ canvas: input.canvas, antialias: true, forceWebGL: input.forceWebGL });
  renderer.outputColorSpace = "srgb";
  renderer.setPixelRatio(1);
  renderer.setClearColor(new Color("#d8d0ba"), 1);
  renderer.shadowMap.enabled = resolveTerrainBenchmarkVariant(input.variant).shadows;
  await renderer.init();
  configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);
  return renderer;
}

function createScene(): Scene {
  const scene = new Scene();
  scene.background = new Color("#d8d0ba");
  scene.add(createLights());
  return scene;
}

function createLights(): Group {
  const lights = new Group();
  lights.name = "procedural-terrain-benchmark-lights";
  lights.add(new AmbientLight(0xdce6df, 1.7));
  const sun = new DirectionalLight(0xffedca, 3.4);
  sun.name = "procedural-terrain-benchmark-sun";
  sun.position.set(7, 11, 8);
  sun.castShadow = true;
  lights.add(sun);
  return lights;
}

function createControls(camera: PerspectiveCamera, canvas: HTMLCanvasElement, locked: boolean): MapControls {
  const controls = new MapControls(camera, canvas);
  controls.enableDamping = false;
  controls.enabled = !locked;
  controls.maxPolarAngle = Math.PI / 2.05;
  return controls;
}

async function loadBenchmarkAssets(runtime: TerrainBenchmarkRuntime): Promise<void> {
  const config = resolveTerrainBenchmarkVariant(runtime.variant);
  const loads: Promise<void>[] = [];
  if (config.texturedGround) loads.push(runtime.terrain.loadGroundTextures());
  if (config.props) loads.push(runtime.terrain.loadProps());
  await Promise.all(loads);
  runtime.terrain.setQualityTier("balanced");
  runtime.terrain.setGroundTextureDetailEnabled(config.texturedGround);
  runtime.terrain.setPropLod("far");
}

function publishBenchmarkBridge(debugWindow: TerrainBenchmarkWindow, runtime: TerrainBenchmarkRuntime): void {
  debugWindow.__terrainBenchmark = {
    getSnapshot: () => readBenchmarkSnapshot(runtime),
    start: () => startBenchmark(runtime),
    status: runtime.status,
    version: TERRAIN_BENCHMARK_CONTRACT_VERSION,
  };
}

function startBenchmark(runtime: TerrainBenchmarkRuntime): Promise<TerrainBenchmarkSnapshot> {
  runtime.benchmarkPromise ??= runBenchmark(runtime).catch((error) => {
    runtime.error = error instanceof Error ? error.message : String(error);
    runtime.status = "error";
    syncBenchmarkBridge(runtime);
    throw error;
  });
  return runtime.benchmarkPromise;
}

async function runBenchmark(runtime: TerrainBenchmarkRuntime): Promise<TerrainBenchmarkSnapshot> {
  requireActive(runtime);
  runtime.status = "running";
  runtime.longTaskObserver = observeLongTasks(runtime.recorder);
  syncBenchmarkBridge(runtime);

  await runStableFrameTrace(runtime);
  await runMotionTrace(runtime);
  if (runtime.runMode === "full") await runLifecycleTrace(runtime);
  runtime.phase = "idle";
  runtime.recorder.setPhase("idle");
  runtime.longTaskObserver?.disconnect();
  runtime.longTaskObserver = null;
  runtime.status = "complete";
  syncBenchmarkBridge(runtime);
  return readBenchmarkSnapshot(runtime);
}

async function runStableFrameTrace(runtime: TerrainBenchmarkRuntime): Promise<void> {
  const frameCounts = resolveStableTraceFrameCounts(runtime);
  await waitForFrames(runtime, frameCounts.warmup);
  setBenchmarkPhase(runtime, "static");
  await waitForFrames(runtime, frameCounts.measured);
}

async function runMotionTrace(runtime: TerrainBenchmarkRuntime): Promise<void> {
  setBenchmarkPhase(runtime, "motion");
  const waypoints = createTerrainBenchmarkMotionWaypoints(runtime.traceMode);
  positionCamera(runtime, waypoints[0], CAMERA_DISTANCE.medium);
  await presentMotionWindow(runtime, waypoints[0]);
  recordCoverage(runtime);
  const segmentDurationMs = resolveMotionSegmentDuration(runtime);

  for (const waypoint of waypoints.slice(1)) {
    await Promise.all([
      presentMotionWindow(runtime, waypoint),
      animateCamera(runtime, waypoint, runtime.cameraDistance, segmentDurationMs),
    ]);
    recordCoverage(runtime);
  }

  for (const distance of [CAMERA_DISTANCE.close, CAMERA_DISTANCE.far, CAMERA_DISTANCE.medium]) {
    await animateCamera(runtime, waypoints.at(-1)!, distance, runtime.runMode === "full" ? 500 : 240);
    runtime.terrain.setPropLod(distance === CAMERA_DISTANCE.close ? "near" : "far");
    recordCoverage(runtime);
  }
}

function resolveStableTraceFrameCounts(runtime: TerrainBenchmarkRuntime): { measured: number; warmup: number } {
  if (runtime.traceMode === "structural") return { measured: 2, warmup: 1 };
  return runtime.runMode === "full" ? { measured: 240, warmup: 120 } : { measured: 120, warmup: 60 };
}

function resolveMotionSegmentDuration(runtime: TerrainBenchmarkRuntime): number {
  if (runtime.traceMode === "structural") return 1;
  return runtime.runMode === "full" ? 600 : 280;
}

function presentMotionWindow(runtime: TerrainBenchmarkRuntime, focus: TerrainBenchmarkPageCoordinate): Promise<void> {
  return presentBenchmarkWindow(runtime, focus, {
    settleFrames: runtime.traceMode !== "structural",
    verifyCoverage: false,
  });
}

async function runLifecycleTrace(runtime: TerrainBenchmarkRuntime): Promise<void> {
  setBenchmarkPhase(runtime, "lifecycle");
  await presentBenchmarkWindow(runtime, INITIAL_FOCUS, { settleFrames: false, verifyCoverage: false });
  positionCamera(runtime, INITIAL_FOCUS, CAMERA_DISTANCE.medium);
  await waitForFrames(runtime, 3);
  const baseline = readRendererMemory(runtime.renderer);
  for (const waypoint of createTerrainBenchmarkLifecycleWaypoints()) {
    await presentBenchmarkWindow(runtime, waypoint, {
      lifecycleVisit: true,
      settleFrames: false,
      verifyCoverage: false,
    });
    positionCamera(runtime, waypoint, CAMERA_DISTANCE.medium);
    await waitForFrames(runtime, 2);
    recordCoverage(runtime);
  }
  await presentBenchmarkWindow(runtime, INITIAL_FOCUS, { settleFrames: false, verifyCoverage: false });
  positionCamera(runtime, INITIAL_FOCUS, CAMERA_DISTANCE.medium);
  await waitForFrames(runtime, 3);
  recordCoverage(runtime);
  const afterReturn = readRendererMemory(runtime.renderer);
  runtime.lifecycleGrowth = {
    geometryGrowth: afterReturn.geometries - baseline.geometries,
    textureGrowth: afterReturn.textures - baseline.textures,
  };
}

async function presentBenchmarkWindow(
  runtime: TerrainBenchmarkRuntime,
  focus: TerrainBenchmarkPageCoordinate,
  options: PresentBenchmarkWindowOptions = {},
): Promise<void> {
  const input = createTerrainBenchmarkWindowInput(runtime.fixture, focus, {
    densityMultiplier: runtime.densityMultiplier,
    explorationMode: runtime.explorationMode,
  });
  runtime.recorder.recordWindowRequest();
  if (options.lifecycleVisit) runtime.recorder.recordLifecyclePageVisit();
  const presentation = await runtime.terrain.presentAsync(input);
  if (!presentation) {
    runtime.recorder.recordStaleWindow();
    return;
  }
  recordPresentation(runtime, input, presentation);
  if (options.settleFrames !== false) await waitForFrames(runtime, 2);
  if (options.verifyCoverage !== false) recordCoverage(runtime);
}

function recordPresentation(
  runtime: TerrainBenchmarkRuntime,
  input: WorldmapProceduralPresentationInput,
  presentation: WorldmapProceduralPresentationDiagnostics,
): void {
  runtime.activeCellKeys = new Set(input.cells.map(({ col, row }) => terrainCellKey(col, row)));
  runtime.recorder.recordWindowCommit({
    builtPages: presentation.builtPages,
    commitMs: presentation.commitMs,
    prepareMs: presentation.prepareMs,
    reusedPages: presentation.reusedPages,
  });
}

function setBenchmarkPhase(runtime: TerrainBenchmarkRuntime, phase: TerrainBenchmarkPhase): void {
  runtime.phase = phase;
  runtime.recorder.setPhase(phase);
}

function startAnimation(runtime: TerrainBenchmarkRuntime): void {
  runtime.renderer.setAnimationLoop((time) => {
    if (runtime.disposed) return;
    updateCameraMotion(runtime, time);
    runtime.recorder.recordFrame(time);
    runtime.controls.update();
    runtime.renderer.render(runtime.scene, runtime.camera);
    runtime.maxDrawCalls = Math.max(runtime.maxDrawCalls, readDrawCalls(runtime.renderer));
    runtime.maxTriangles = Math.max(runtime.maxTriangles, runtime.renderer.info.render.triangles);
    resolveFrameWaiters(runtime);
  });
}

function animateCamera(
  runtime: TerrainBenchmarkRuntime,
  focus: TerrainBenchmarkPageCoordinate,
  distance: number,
  durationMs: number,
): Promise<void> {
  if (runtime.cameraMotion) throw new Error("Terrain benchmark camera motion overlapped another motion");
  const toTarget = resolvePageCenter(focus);
  return new Promise((resolve) => {
    runtime.cameraMotion = {
      durationMs,
      fromDistance: runtime.cameraDistance,
      fromTarget: runtime.controls.target.clone(),
      resolve,
      startedAt: performance.now(),
      toDistance: distance,
      toTarget,
    };
  });
}

function updateCameraMotion(runtime: TerrainBenchmarkRuntime, time: number): void {
  const motion = runtime.cameraMotion;
  if (!motion) return;
  const progress = Math.min(1, Math.max(0, (time - motion.startedAt) / motion.durationMs));
  const eased = progress * progress * (3 - 2 * progress);
  const target = motion.fromTarget.clone().lerp(motion.toTarget, eased);
  const distance = motion.fromDistance + (motion.toDistance - motion.fromDistance) * eased;
  applyCameraPosition(runtime, target, distance);
  if (progress < 1) return;
  runtime.cameraMotion = null;
  motion.resolve();
}

function positionCamera(
  runtime: TerrainBenchmarkRuntime,
  focus: TerrainBenchmarkPageCoordinate,
  distance: number,
): void {
  applyCameraPosition(runtime, resolvePageCenter(focus), distance);
}

function applyCameraPosition(runtime: TerrainBenchmarkRuntime, target: Vector3, distance: number): void {
  runtime.cameraDistance = distance;
  runtime.camera.position.copy(target).addScaledVector(CAMERA_DIRECTION, distance);
  runtime.controls.target.copy(target);
  runtime.camera.lookAt(target);
  runtime.controls.update();
}

function resolvePageCenter(focus: TerrainBenchmarkPageCoordinate): Vector3 {
  const center = terrainHexToWorld(
    focus.col * TERRAIN_BENCHMARK_PAGE_SIZE + TERRAIN_BENCHMARK_PAGE_SIZE / 2,
    focus.row * TERRAIN_BENCHMARK_PAGE_SIZE + TERRAIN_BENCHMARK_PAGE_SIZE / 2,
  );
  return new Vector3(center.x, 0, center.z);
}

function recordCoverage(runtime: TerrainBenchmarkRuntime): void {
  const raycaster = new Raycaster();
  const intersection = new Vector3();
  let missingSamples = 0;
  for (const y of COVERAGE_GRID) {
    for (const x of COVERAGE_GRID) {
      raycaster.setFromCamera(new Vector2(x, y), runtime.camera);
      if (!raycaster.ray.intersectPlane(GROUND_PLANE, intersection)) {
        missingSamples += 1;
        continue;
      }
      const owner = findNearestTerrainHex(intersection.x, intersection.z);
      if (!runtime.activeCellKeys.has(terrainCellKey(owner.col, owner.row))) missingSamples += 1;
    }
  }
  runtime.recorder.recordCoverage(COVERAGE_GRID.length ** 2, missingSamples);
}

function waitForFrames(runtime: TerrainBenchmarkRuntime, count: number): Promise<void> {
  return new Promise((resolve) => runtime.frameWaiters.push({ framesRemaining: Math.max(1, count), resolve }));
}

function resolveFrameWaiters(runtime: TerrainBenchmarkRuntime): void {
  for (const waiter of runtime.frameWaiters) waiter.framesRemaining -= 1;
  const resolved = runtime.frameWaiters.filter(({ framesRemaining }) => framesRemaining <= 0);
  runtime.frameWaiters = runtime.frameWaiters.filter(({ framesRemaining }) => framesRemaining > 0);
  resolved.forEach(({ resolve }) => resolve());
}

function observeLongTasks(recorder: TerrainBenchmarkRecorder): PerformanceObserver | null {
  if (typeof PerformanceObserver === "undefined") return null;
  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(({ duration }) => recorder.recordLongTask(duration));
    });
    observer.observe({ type: "longtask", buffered: false });
    return observer;
  } catch {
    return null;
  }
}

function observeCanvas(canvas: HTMLCanvasElement, runtime: TerrainBenchmarkRuntime): ResizeObserver {
  const observer = new ResizeObserver(() => resizeRenderer(canvas, runtime));
  observer.observe(canvas);
  resizeRenderer(canvas, runtime);
  return observer;
}

function resizeRenderer(canvas: HTMLCanvasElement, runtime: TerrainBenchmarkRuntime): void {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(bounds.width));
  const height = Math.max(1, Math.floor(bounds.height));
  runtime.renderer.setSize(width, height);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
}

function readBenchmarkSnapshot(runtime: TerrainBenchmarkRuntime): TerrainBenchmarkSnapshot {
  const recorder = runtime.recorder.snapshot();
  const memory = readRendererMemory(runtime.renderer);
  const propInstances = runtime.terrain.getVisibleCellCount() === 0 ? 0 : countVisiblePropInstances(runtime.terrain);
  return {
    activeMode: runtime.forceWebGL || !WebGPU.isAvailable() ? "webgl2-fallback" : "webgpu",
    assets: readAssetRequestCounts(),
    chunks: recorder.chunks,
    contractVersion: TERRAIN_BENCHMARK_CONTRACT_VERSION,
    densityMultiplier: runtime.densityMultiplier,
    coverage: recorder.coverage,
    fixture: {
      cellCount: TERRAIN_BENCHMARK_CELL_COLUMNS * TERRAIN_BENCHMARK_CELL_ROWS,
      explorationMode: runtime.explorationMode,
      fingerprint: runtime.fixture.fingerprint,
      pageCount: TERRAIN_BENCHMARK_PAGE_COLUMNS * TERRAIN_BENCHMARK_PAGE_ROWS,
      visiblePageCount: TERRAIN_BENCHMARK_WINDOW_COLUMNS * TERRAIN_BENCHMARK_WINDOW_ROWS,
    },
    frames: recorder.frames,
    lifecycle: runtime.lifecycleGrowth,
    longTasks: recorder.longTasks,
    render: {
      drawCalls: runtime.maxDrawCalls || readDrawCalls(runtime.renderer),
      firstRenderMs: runtime.firstRenderMs,
      geometries: memory.geometries,
      pixelRatio: runtime.renderer.getPixelRatio(),
      propInstances,
      shroudInstances: runtime.terrain.getShroudStats().instances,
      textures: memory.textures,
      triangles: runtime.maxTriangles || runtime.renderer.info.render.triangles,
    },
    runMode: runtime.runMode,
    status: runtime.status,
    variant: runtime.variant,
  };
}

function countVisiblePropInstances(terrain: WorldmapProceduralTerrain): number {
  let instances = 0;
  terrain.object3d.traverse((object) => {
    const count = (object as unknown as { count?: unknown }).count;
    if (typeof count === "number" && object.name.startsWith("terrain-prop-pool:")) instances += count;
  });
  return instances;
}

function readAssetRequestCounts(): TerrainBenchmarkSnapshot["assets"] {
  const resourceNames = performance.getEntriesByType("resource").map(({ name }) => name);
  return {
    groundArrayRequests: resourceNames.filter((name) => name.includes("/textures/procedural-terrain/ground-")).length,
    propCatalogRequests: resourceNames.filter((name) => name.endsWith("/ultimate-nature-props.glb")).length,
  };
}

function readRendererMemory(renderer: TerrainBenchmarkRendererSurface): { geometries: number; textures: number } {
  return { ...renderer.info.memory };
}

function readDrawCalls(renderer: TerrainBenchmarkRendererSurface): number {
  return renderer.info.render.drawCalls ?? renderer.info.render.calls;
}

function syncBenchmarkBridge(runtime: TerrainBenchmarkRuntime): void {
  const bridge = (window as TerrainBenchmarkWindow).__terrainBenchmark;
  if (!bridge) return;
  bridge.status = runtime.status;
  if (runtime.error) bridge.error = runtime.error;
}

function disposeBenchmarkRuntime(
  debugWindow: TerrainBenchmarkWindow,
  runtime: TerrainBenchmarkRuntime,
  resizeObserver: ResizeObserver,
): void {
  if (runtime.disposed) return;
  runtime.disposed = true;
  runtime.renderer.setAnimationLoop(null);
  runtime.longTaskObserver?.disconnect();
  runtime.frameWaiters.splice(0).forEach(({ resolve }) => resolve());
  runtime.cameraMotion?.resolve();
  runtime.cameraMotion = null;
  resizeObserver.disconnect();
  runtime.controls.dispose();
  runtime.terrain.dispose();
  runtime.scene.clear();
  runtime.renderer.dispose();
  delete debugWindow.__terrainBenchmark;
}

function requireActive(runtime: TerrainBenchmarkRuntime): void {
  if (runtime.disposed) throw new Error("Terrain benchmark renderer has been disposed");
}
