import { AmbientLight, Color, DirectionalLight, Group, PerspectiveCamera, Scene, Vector3 } from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import WebGPU from "three/addons/capabilities/WebGPU.js";
import { WebGPURenderer } from "three/webgpu";

import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import { createAllBiomesTerrainRequest } from "@/three/terrain/verification/terrain-verification-fixtures";
import { configureGltfTextureSupport } from "@/three/utils/utils";

export interface ProceduralTerrainDebugStats {
  activeMode: "webgl2-fallback" | "webgpu";
  biomeCount: number;
  cellCount: number;
  commitMs: number;
  drawCalls: number;
  fingerprint: string;
  firstRenderMs: number;
  frameP50Ms: number;
  frameP95Ms: number;
  frameWorstMs: number;
  frameSampleCount: number;
  groundTextureBytes: number;
  groundTextureLayers: number;
  prepareMs: number;
  propInstances: number;
  shadingMode: "flat" | "textured";
  triangles: number;
  textures: number;
  vertices: number;
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
  renderer.outputColorSpace = "srgb";
  renderer.setPixelRatio(1);
  renderer.setClearColor(new Color("#d8d0ba"), 1);
  renderer.shadowMap.enabled = true;
  await renderer.init();
  configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);

  const scene = new Scene();
  scene.background = new Color("#d8d0ba");
  const request = createAllBiomesTerrainRequest();
  const camera = new PerspectiveCamera(36, 1, 0.1, 300);
  const controls = new MapControls(camera, input.canvas);
  controls.enableDamping = false;
  controls.enabled = !input.captureMode;
  controls.maxPolarAngle = Math.PI / 2.05;
  const cameraFrame = createCameraFrame(camera, request.cells);
  positionCamera(camera, controls, cameraFrame);

  const terrain = new ProceduralTerrain();
  await Promise.all([terrain.loadProps(), terrain.loadGroundTextures()]);
  const prepared = await terrain.preparePageAsync(request);
  const commitStartedAt = performance.now();
  terrain.present([prepared]);
  const commitMs = performance.now() - commitStartedAt;
  const propStats = terrain.getPropStats();
  const groundTextureStats = terrain.getGroundTextureStats();
  terrain.object3d.userData.verification = {
    biomeCount: new Set(prepared.request.cells.map(({ biome }) => biome).filter(Boolean)).size,
    cellCount: prepared.request.cells.length,
    commitMs,
    fingerprint: prepared.fingerprint,
    groundTextureBytes: groundTextureStats.bytes,
    groundTextureLayers: groundTextureStats.layerCount,
    prepareMs: prepared.diagnostics.prepareMs,
    propInstances: propStats.instances,
    triangles: prepared.diagnostics.triangles + propStats.triangles,
    vertices: prepared.diagnostics.vertices,
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
  scene.add(createLights());
  terrain.setGroundTextureDetailEnabled(input.texturedGround);
  const firstRenderStartedAt = performance.now();
  renderer.render(scene, camera);
  const firstRenderMs = performance.now() - firstRenderStartedAt;

  return { camera, cameraFrame, controls, frameSamplesMs: [], renderer, scene, terrain, firstRenderMs };
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
