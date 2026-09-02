import {
  ACESFilmicToneMapping,
  AmbientLight,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Timer,
  type Texture,
  Vector3,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import WebGPU from "three/addons/capabilities/WebGPU.js";
import { WebGPURenderer } from "three/webgpu";

import { StructureType } from "@bibliothecadao/types";
import { getStructureModelPaths } from "../constants/scene-constants";
import type { RendererSurfaceLike } from "../renderer-backend";
import { ResourceFlowLayer, type ResourceFlowStats } from "../fx/resource-flow-layer";
import { createWorldFxRuntime, type WorldFxRuntime, type WorldFxStats } from "../fx/world-fx-runtime";
import { collectMaterialTextures } from "../utils/material-textures";
import { configureGltfTextureSupport, gltfLoader } from "../utils/utils";
import {
  createWorldFxGymFixture,
  type WorldFxGymCount,
  type WorldFxGymScenario,
  type WorldFxGymView,
} from "./world-fx-gym-fixture";

export interface WorldFxGymStats extends WorldFxStats {
  activeMode: "webgl2-fallback" | "webgpu";
  emitterCount: WorldFxGymCount;
  fps: number;
  frameMs: number;
  geometryCount: number;
  paused: boolean;
  rendererDrawCalls: number;
  rendererTriangles: number;
  resourceFlows: ResourceFlowStats;
  scenario: WorldFxGymScenario;
  textureCount: number;
  view: WorldFxGymView;
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
  view: WorldFxGymView;
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
  resourceFlows: ResourceFlowLayer | null;
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
  renderer.setClearColor(new Color("#08090c"), 1);
  renderer.shadowMap.enabled = false;
  renderer.info.autoReset = false;
  await renderer.init();

  const scene = new Scene();
  scene.background = new Color("#08090c");
  const camera = new PerspectiveCamera(42, 1, 0.1, 160);
  const controls = new MapControls(camera, input.canvas);
  controls.enableDamping = !input.captureMode;
  controls.enabled = !input.captureMode;
  controls.maxPolarAngle = Math.PI / 2.08;
  const fixture = createWorldFxGymFixture(input);
  const stage = await createStage(fixture, renderer);
  positionCamera(camera, controls, fixture, input.view);
  scene.add(stage, createLights());

  const timer = new Timer();
  timer.connect(document);
  const worldFx = createWorldFxRuntime({ camera, scene });
  const resourceFlows = fixture.resourceFlows.length > 0 ? new ResourceFlowLayer() : null;
  if (resourceFlows) scene.add(resourceFlows.object3d);
  return {
    camera,
    controls,
    elapsedImpactSeconds: 0,
    fixture,
    frameMs: 0,
    input,
    paused: false,
    renderer,
    resourceFlows,
    scene,
    stage,
    timer,
    worldFx,
  };
}

async function createStage(
  fixture: ReturnType<typeof createWorldFxGymFixture>,
  renderer: WorldFxGymRendererSurface,
): Promise<Group> {
  const stage = new Group();
  stage.name = "world-fx-gym-stage";
  const span = Math.max(10, Math.ceil(Math.sqrt(fixture.positions.length)) * 2.9);
  const ground = new Mesh(
    new PlaneGeometry(span, span),
    new MeshStandardMaterial({ color: "#2b211c", metalness: 0.04, roughness: 0.94 }),
  );
  ground.name = "world-fx-gym-ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  stage.add(ground);

  if (fixture.stageKind === "realm") await addSettlementRealm(stage, renderer);
  else if (fixture.stageKind === "resource-map") addResourceMapMarkers(stage, fixture.positions);
  else addPedestals(stage, fixture.positions);
  return stage;
}

function addResourceMapMarkers(stage: Group, positions: readonly Vector3[]): void {
  const geometry = new CylinderGeometry(0.55, 0.68, 0.48, 6);
  const material = new MeshStandardMaterial({ color: "#86705d", metalness: 0.08, roughness: 0.88, vertexColors: true });
  const markers = new InstancedMesh(geometry, material, positions.length);
  const matrix = new Matrix4();
  const colors = ["#a85832", "#76965c", "#7284a7", "#9a715a", "#b49a62"];
  positions.forEach((position, index) => {
    matrix.makeTranslation(position.x, 0.22, position.z);
    markers.setMatrixAt(index, matrix);
    markers.setColorAt(index, new Color(colors[index % colors.length]));
  });
  markers.name = "world-fx-resource-map-entities";
  markers.instanceMatrix.setUsage(DynamicDrawUsage);
  markers.instanceMatrix.needsUpdate = true;
  if (markers.instanceColor) markers.instanceColor.needsUpdate = true;
  stage.add(markers);
}

function addPedestals(stage: Group, positions: readonly Vector3[]): void {
  const pedestalGeometry = new CylinderGeometry(0.48, 0.58, 0.16, 12);
  const pedestalMaterial = new MeshStandardMaterial({ color: "#49372b", metalness: 0.1, roughness: 0.82 });
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
}

async function addSettlementRealm(stage: Group, renderer: WorldFxGymRendererSurface): Promise<void> {
  configureGltfTextureSupport(renderer);
  const realmPath = getStructureModelPaths(false)[StructureType.Realm][0];
  const gltf = await gltfLoader.loadAsync(realmPath);
  const realm = gltf.scene;
  realm.name = "world-fx-gym-settlement-realm";
  realm.position.y = -0.08;
  realm.rotation.y = Math.PI;
  realm.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  stage.add(realm);
}

function createLights(): Group {
  const lights = new Group();
  lights.name = "world-fx-gym-lights";
  lights.add(new AmbientLight(0x786f6a, 1.15));
  const key = new DirectionalLight(0xffd9ba, 2.2);
  key.position.set(8, 12, 7);
  lights.add(key);
  return lights;
}

function primeScenario(runtime: WorldFxGymRuntime): void {
  runtime.worldFx.sync(runtime.fixture.persistentEmitters);
  runtime.resourceFlows?.sync(runtime.fixture.resourceFlows);
  emitTransientCues(runtime);
  runtime.worldFx.update(0);
}

function advanceCapture(runtime: WorldFxGymRuntime, targetSeconds: number): void {
  let elapsed = 0;
  const target = Math.max(0, Math.min(4, targetSeconds));
  while (elapsed < target) {
    const delta = Math.min(CAPTURE_STEP_SECONDS, target - elapsed);
    runtime.worldFx.update(delta);
    runtime.resourceFlows?.update(delta);
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
  runtime.resourceFlows?.update(deltaSeconds);
  if (runtime.fixture.transientCues.length === 0) return;
  runtime.elapsedImpactSeconds += Math.min(0.05, Math.max(0, deltaSeconds));
  if (runtime.elapsedImpactSeconds < IMPACT_REPLAY_SECONDS) return;
  runtime.elapsedImpactSeconds %= IMPACT_REPLAY_SECONDS;
  emitTransientCues(runtime);
}

function emitTransientCues(runtime: WorldFxGymRuntime): void {
  for (const cue of runtime.fixture.transientCues) runtime.worldFx.emit(cue);
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
      runtime.resourceFlows?.dispose();
      disposeStage(runtime.stage);
      runtime.renderer.dispose();
      delete debugWindow.__worldFxGym;
    },
    emitBurst: () => {
      if (disposed) return;
      emitTransientCues(runtime);
      runtime.worldFx.update(0);
      renderFrame(runtime);
    },
    getStats: () => readStats(runtime),
    resetCamera: () => positionCamera(runtime.camera, runtime.controls, runtime.fixture, runtime.input.view),
    setPaused: (paused: boolean) => {
      runtime.paused = paused;
    },
  };
}

function readStats(runtime: WorldFxGymRuntime): WorldFxGymStats {
  const fx = runtime.worldFx.getStats();
  const resourceFlows = runtime.resourceFlows?.getStats() ?? EMPTY_RESOURCE_FLOW_STATS;
  const render = runtime.renderer.info.render;
  return {
    ...fx,
    activeMode: runtime.input.forceWebGL || !WebGPU.isAvailable() ? "webgl2-fallback" : "webgpu",
    emitterCount: runtime.input.count,
    fps: runtime.frameMs > 0 ? Math.round(1_000 / runtime.frameMs) : 0,
    frameMs: Math.round(runtime.frameMs * 100) / 100,
    geometryCount: runtime.renderer.info.memory.geometries,
    paused: runtime.paused,
    rendererDrawCalls: render.drawCalls ?? render.calls,
    rendererTriangles: render.triangles,
    resourceFlows,
    scenario: runtime.input.scenario,
    textureCount: runtime.renderer.info.memory.textures,
    view: runtime.input.view,
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

function positionCamera(
  camera: PerspectiveCamera,
  controls: MapControls,
  fixture: ReturnType<typeof createWorldFxGymFixture>,
  view: WorldFxGymView,
): void {
  const distance =
    fixture.stageKind === "realm"
      ? view === "gameplay"
        ? 5.2
        : 2.25
      : fixture.stageKind === "resource-map"
        ? Math.max(7.4, fixture.span * 0.85)
        : Math.max(3.5, fixture.span * 0.75);
  camera.position.set(distance * 0.72, distance * 0.72, distance);
  controls.target.set(0, fixture.stageKind === "realm" ? 0.55 : fixture.stageKind === "resource-map" ? 0.25 : 0.65, 0);
  camera.lookAt(controls.target);
  controls.update();
}

const EMPTY_RESOURCE_FLOW_STATS: ResourceFlowStats = {
  activeFlows: 0,
  activePackets: 0,
  activeRouteSegments: 0,
  drawCalls: 0,
  droppedFlows: 0,
  droppedResources: 0,
  packetCapacity: 0,
  routeSegmentCapacity: 0,
  triangles: 0,
};

function disposeStage(stage: Group): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  stage.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof InstancedMesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      collectMaterialTextures(material, textures);
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  stage.clear();
  stage.removeFromParent();
}
