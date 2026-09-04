import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Timer,
  Vector3,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { resolveWebGpuRendererActiveMode } from "@/three/webgpu-renderer-backend";
import { WebGPURenderer } from "three/webgpu";

import type { RendererSurfaceLike } from "../renderer-backend";
import { createWorldFxRuntime, type WorldFxRuntime, type WorldFxStats } from "../fx/world-fx-runtime";
import { createWorldFxGymFixture, type WorldFxGymCount, type WorldFxGymScenario } from "./world-fx-gym-fixture";

export interface WorldFxGymStats extends WorldFxStats {
  activeMode: "webgl2-fallback" | "webgpu";
  emitterCount: WorldFxGymCount;
  fps: number;
  frameMs: number;
  paused: boolean;
  rendererDrawCalls: number;
  rendererTriangles: number;
  scenario: WorldFxGymScenario;
}

export interface WorldFxGymRendererHandle {
  dispose(): void;
  emitBurst(): void;
  getStats(): WorldFxGymStats;
  resetCamera(): void;
  setPaused(paused: boolean): void;
}

export interface MountWorldFxGymRendererInput {
  canvas: HTMLCanvasElement;
  captureMode: boolean;
  captureTimeSeconds: number;
  count: WorldFxGymCount;
  forceWebGL: boolean;
  onFrame?(stats: WorldFxGymStats): void;
  onReady(stats: WorldFxGymStats): void;
  scenario: WorldFxGymScenario;
  seed: number;
}

interface WorldFxGymRuntime {
  camera: PerspectiveCamera;
  controls: MapControls;
  elapsedImpactSeconds: number;
  fixture: ReturnType<typeof createWorldFxGymFixture>;
  frameMs: number;
  input: MountWorldFxGymRendererInput;
  paused: boolean;
  renderer: WorldFxGymRendererSurface;
  scene: Scene;
  stage: Group;
  timer: Timer;
  worldFx: WorldFxRuntime;
}

interface WorldFxGymRendererSurface extends RendererSurfaceLike {
  init(): Promise<void>;
  setAnimationLoop(callback: ((time: number) => void) | null): void;
  setClearColor(color: Color, alpha?: number): void;
}

type WorldFxGymRendererConstructor = new (options: {
  antialias: boolean;
  canvas: HTMLCanvasElement;
  forceWebGL: boolean;
}) => WorldFxGymRendererSurface;

type WorldFxGymDebugWindow = Window & {
  __worldFxGym?: {
    emitBurst?: () => void;
    error?: string;
    getSnapshot?: () => WorldFxGymStats;
    status: "booting" | "error" | "ready";
    version: 1;
  };
};

const IMPACT_REPLAY_SECONDS = 1.6;
const FRAME_PUBLISH_INTERVAL_MS = 250;
const CAPTURE_STEP_SECONDS = 1 / 60;

export async function mountWorldFxGymRenderer(input: MountWorldFxGymRendererInput): Promise<WorldFxGymRendererHandle> {
  const debugWindow = window as WorldFxGymDebugWindow;
  debugWindow.__worldFxGym = { status: "booting", version: 1 };
  try {
    const runtime = await createRuntime(input);
    const resizeObserver = observeCanvas(input.canvas, runtime);
    primeScenario(runtime);
    if (input.captureMode) advanceCapture(runtime, input.captureTimeSeconds);
    renderFrame(runtime);
    const stopAnimation = input.captureMode ? () => {} : startAnimation(runtime);
    const handle = createHandle(runtime, resizeObserver, stopAnimation, debugWindow);
    const stats = readStats(runtime);
    debugWindow.__worldFxGym = {
      emitBurst: handle.emitBurst,
      getSnapshot: handle.getStats,
      status: "ready",
      version: 1,
    };
    input.onReady(stats);
    return handle;
  } catch (error) {
    debugWindow.__worldFxGym = {
      error: error instanceof Error ? error.message : String(error),
      status: "error",
      version: 1,
    };
    throw error;
  }
}

async function createRuntime(input: MountWorldFxGymRendererInput): Promise<WorldFxGymRuntime> {
  const Renderer = WebGPURenderer as unknown as WorldFxGymRendererConstructor;
  const renderer = new Renderer({ antialias: true, canvas: input.canvas, forceWebGL: input.forceWebGL });
  renderer.outputColorSpace = "srgb";
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setPixelRatio(1);
  renderer.setClearColor(new Color("#120d0b"), 1);
  renderer.shadowMap.enabled = false;
  renderer.info.autoReset = false;
  await renderer.init();

  const scene = new Scene();
  scene.background = new Color("#120d0b");
  const camera = new PerspectiveCamera(42, 1, 0.1, 160);
  const controls = new MapControls(camera, input.canvas);
  controls.enableDamping = !input.captureMode;
  controls.enabled = !input.captureMode;
  controls.maxPolarAngle = Math.PI / 2.08;
  const fixture = createWorldFxGymFixture(input);
  const stage = createStage(fixture.positions);
  positionCamera(camera, controls, fixture.span);
  scene.add(stage, createLights());

  const timer = new Timer();
  timer.connect(document);
  const worldFx = createWorldFxRuntime({ camera, scene });
  return {
    camera,
    controls,
    elapsedImpactSeconds: 0,
    fixture,
    frameMs: 0,
    input,
    paused: false,
    renderer,
    scene,
    stage,
    timer,
    worldFx,
  };
}

function createStage(positions: readonly Vector3[]): Group {
  const stage = new Group();
  stage.name = "world-fx-gym-stage";
  const span = Math.max(10, Math.ceil(Math.sqrt(positions.length)) * 2.9);
  const ground = new Mesh(
    new PlaneGeometry(span, span),
    new MeshStandardMaterial({ color: "#211b18", metalness: 0.05, roughness: 0.92 }),
  );
  ground.name = "world-fx-gym-ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  stage.add(ground);

  const pedestalGeometry = new CylinderGeometry(0.48, 0.58, 0.16, 12);
  const pedestalMaterial = new MeshStandardMaterial({ color: "#44352b", metalness: 0.12, roughness: 0.78 });
  const pedestals = new InstancedMesh(pedestalGeometry, pedestalMaterial, positions.length);
  const matrix = new Matrix4();
  positions.forEach((position, index) => {
    matrix.makeTranslation(position.x, 0.05, position.z);
    pedestals.setMatrixAt(index, matrix);
  });
  pedestals.name = "world-fx-gym-pedestals";
  pedestals.instanceMatrix.setUsage(DynamicDrawUsage);
  pedestals.instanceMatrix.needsUpdate = true;
  stage.add(pedestals);
  return stage;
}

function createLights(): Group {
  const lights = new Group();
  lights.name = "world-fx-gym-lights";
  lights.add(new AmbientLight(0x8d7467, 1.35));
  const key = new DirectionalLight(0xffd9ba, 2.2);
  key.position.set(8, 12, 7);
  lights.add(key);
  return lights;
}

function primeScenario(runtime: WorldFxGymRuntime): void {
  runtime.worldFx.sync(runtime.fixture.flameEmitters);
  emitImpactBurst(runtime);
  runtime.worldFx.update(0);
}

function advanceCapture(runtime: WorldFxGymRuntime, targetSeconds: number): void {
  let elapsed = 0;
  const target = Math.max(0, Math.min(4, targetSeconds));
  while (elapsed < target) {
    const delta = Math.min(CAPTURE_STEP_SECONDS, target - elapsed);
    runtime.worldFx.update(delta);
    elapsed += delta;
  }
}

function startAnimation(runtime: WorldFxGymRuntime): () => void {
  let lastPublishTime = performance.now();
  runtime.renderer.setAnimationLoop((time) => {
    runtime.timer.update(time);
    const delta = runtime.timer.getDelta();
    runtime.frameMs = delta * 1_000;
    if (!runtime.paused) advanceRuntime(runtime, delta);
    runtime.controls.update();
    renderFrame(runtime);
    if (time - lastPublishTime >= FRAME_PUBLISH_INTERVAL_MS) {
      lastPublishTime = time;
      runtime.input.onFrame?.(readStats(runtime));
    }
  });
  return () => runtime.renderer.setAnimationLoop(null);
}

function advanceRuntime(runtime: WorldFxGymRuntime, deltaSeconds: number): void {
  runtime.worldFx.update(deltaSeconds);
  if (runtime.fixture.impactCues.length === 0) return;
  runtime.elapsedImpactSeconds += Math.min(0.05, Math.max(0, deltaSeconds));
  if (runtime.elapsedImpactSeconds < IMPACT_REPLAY_SECONDS) return;
  runtime.elapsedImpactSeconds %= IMPACT_REPLAY_SECONDS;
  emitImpactBurst(runtime);
}

function emitImpactBurst(runtime: WorldFxGymRuntime): void {
  for (const cue of runtime.fixture.impactCues) runtime.worldFx.emit(cue);
}

function renderFrame(runtime: WorldFxGymRuntime): void {
  runtime.renderer.info.reset();
  runtime.renderer.render(runtime.scene, runtime.camera);
}

function createHandle(
  runtime: WorldFxGymRuntime,
  resizeObserver: ResizeObserver,
  stopAnimation: () => void,
  debugWindow: WorldFxGymDebugWindow,
): WorldFxGymRendererHandle {
  let disposed = false;
  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      stopAnimation();
      resizeObserver.disconnect();
      runtime.timer.dispose();
      runtime.controls.dispose();
      runtime.worldFx.dispose();
      disposeStage(runtime.stage);
      runtime.renderer.dispose();
      delete debugWindow.__worldFxGym;
    },
    emitBurst: () => {
      if (disposed) return;
      emitImpactBurst(runtime);
      runtime.worldFx.update(0);
      renderFrame(runtime);
    },
    getStats: () => readStats(runtime),
    resetCamera: () => positionCamera(runtime.camera, runtime.controls, runtime.fixture.span),
    setPaused: (paused: boolean) => {
      runtime.paused = paused;
    },
  };
}

function readStats(runtime: WorldFxGymRuntime): WorldFxGymStats {
  const fx = runtime.worldFx.getStats();
  const render = runtime.renderer.info.render;
  return {
    ...fx,
    activeMode: resolveWebGpuRendererActiveMode(runtime.renderer),
    emitterCount: runtime.input.count,
    fps: runtime.frameMs > 0 ? Math.round(1_000 / runtime.frameMs) : 0,
    frameMs: Math.round(runtime.frameMs * 100) / 100,
    paused: runtime.paused,
    rendererDrawCalls: render.drawCalls ?? render.calls,
    rendererTriangles: render.triangles,
    scenario: runtime.input.scenario,
  };
}

function observeCanvas(canvas: HTMLCanvasElement, runtime: WorldFxGymRuntime): ResizeObserver {
  const observer = new ResizeObserver(() => resizeRenderer(canvas, runtime));
  observer.observe(canvas);
  resizeRenderer(canvas, runtime);
  return observer;
}

function resizeRenderer(canvas: HTMLCanvasElement, runtime: WorldFxGymRuntime): void {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(bounds.width));
  const height = Math.max(1, Math.floor(bounds.height));
  runtime.renderer.setSize(width, height);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
}

function positionCamera(camera: PerspectiveCamera, controls: MapControls, span: number): void {
  const distance = Math.max(3.5, span * 0.75);
  camera.position.set(distance * 0.72, distance * 0.72, distance);
  controls.target.set(0, 0.65, 0);
  camera.lookAt(controls.target);
  controls.update();
}

function disposeStage(stage: Group): void {
  stage.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof InstancedMesh)) return;
    object.geometry.dispose();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
    else object.material.dispose();
  });
  stage.clear();
  stage.removeFromParent();
}
