import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

import {
  buildDebugChunkFixture,
  type DebugChunkFixture,
  type DebugChunkHeat,
  type DebugChunkScenario,
} from "./three-chunk-debug-fixture";

export interface ThreeChunkDebugFrameStats {
  fps: number;
  frameMs: number;
  renderedChunks: number;
  drawCalls: number;
  triangles: number;
}

export interface ThreeChunkDebugRendererHandle {
  dispose: () => void;
  resetCamera: () => void;
}

interface MountThreeChunkDebugRendererInput {
  canvas: HTMLCanvasElement;
  scenario: DebugChunkScenario;
  onFrame?: (stats: ThreeChunkDebugFrameStats) => void;
}

interface DebugRuntime {
  fixture: DebugChunkFixture;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: MapControls;
  hotLight: THREE.PointLight;
}

interface AnimationHandle {
  stop: () => void;
}

const FRAME_STATS_INTERVAL_MS = 250;

export const mountThreeChunkDebugRenderer = (
  input: MountThreeChunkDebugRendererInput,
): ThreeChunkDebugRendererHandle => {
  const fixture = buildDebugChunkFixture(input.scenario);
  const runtime = createDebugRuntime(input.canvas, input.scenario, fixture);
  const resizeObserver = observeDebugCanvas(input.canvas, runtime);
  const animation = startDebugAnimation(runtime, input.onFrame);

  return {
    dispose: () => {
      animation.stop();
      resizeObserver.disconnect();
      destroyDebugRuntime(runtime);
    },
    resetCamera: () => {
      positionDebugCamera(runtime.camera, runtime.controls, runtime.fixture);
    },
  };
};

const createDebugRuntime = (
  canvas: HTMLCanvasElement,
  scenario: DebugChunkScenario,
  fixture: DebugChunkFixture,
): DebugRuntime => {
  const renderer = createDebugRenderer(canvas);
  const scene = createDebugScene();
  const camera = createDebugCamera();
  const controls = createDebugControls(camera, canvas);
  const hotLight = createHotChunkLight();

  positionDebugCamera(camera, controls, fixture);
  scene.add(createChunkInstancedMesh(fixture));
  scene.add(createChunkOutlines(fixture));
  scene.add(createWorldGrid(fixture, scenario));
  scene.add(createSceneLights());
  scene.add(hotLight);

  return {
    fixture,
    renderer,
    scene,
    camera,
    controls,
    hotLight,
  };
};

const createDebugRenderer = (canvas: HTMLCanvasElement): THREE.WebGLRenderer => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    // Required for CI readPixels smoke checks. Keep this out of the production renderer.
    preserveDrawingBuffer: true,
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x05070b, 1);

  return renderer;
};

const createDebugScene = (): THREE.Scene => {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05070b, 120, 260);
  return scene;
};

const createDebugCamera = (): THREE.PerspectiveCamera => new THREE.PerspectiveCamera(42, 1, 0.1, 1000);

const createDebugControls = (camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement): MapControls => {
  const controls = new MapControls(camera, canvas);

  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.minDistance = 18;
  controls.maxDistance = 240;
  controls.maxPolarAngle = Math.PI / 2.15;

  return controls;
};

const createChunkInstancedMesh = (fixture: DebugChunkFixture): THREE.InstancedMesh => {
  const geometry = new THREE.BoxGeometry(fixture.chunkSize * 0.92, 0.36, fixture.chunkSize * 0.92);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.06,
    vertexColors: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, fixture.chunks.length);
  const transform = new THREE.Object3D();
  const color = new THREE.Color();

  fixture.chunks.forEach((chunk, index) => {
    transform.position.set(chunk.center.x, resolveChunkHeight(chunk.heat), chunk.center.z);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, color.setHex(resolveChunkColor(chunk.heat)));
  });

  mesh.name = "three-chunk-debug-instanced-chunks";
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return mesh;
};

const createChunkOutlines = (fixture: DebugChunkFixture): THREE.LineSegments => {
  const points = fixture.chunks.flatMap((chunk) => buildChunkOutlinePoints(chunk.bounds));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xe7d08a,
    transparent: true,
    opacity: 0.34,
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.name = "three-chunk-debug-boundaries";

  return lines;
};

const createWorldGrid = (fixture: DebugChunkFixture, scenario: DebugChunkScenario): THREE.GridHelper => {
  const width = fixture.worldBounds.maxX - fixture.worldBounds.minX;
  const depth = fixture.worldBounds.maxZ - fixture.worldBounds.minZ;
  const size = Math.max(width, depth);
  const divisions = (scenario.chunkRadius * 2 + 1) * 2;
  const grid = new THREE.GridHelper(size, divisions, 0x7fb5ff, 0x26313f);

  grid.position.y = -0.04;
  grid.name = "three-chunk-debug-tile-grid";

  return grid;
};

const createSceneLights = (): THREE.Group => {
  const lights = new THREE.Group();
  const ambient = new THREE.HemisphereLight(0xbdd7ff, 0x17202d, 1.2);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);

  key.position.set(42, 78, 36);
  lights.add(ambient, key);

  return lights;
};

const createHotChunkLight = (): THREE.PointLight => {
  const light = new THREE.PointLight(0xffbf63, 36, 120, 1.8);

  light.position.set(0, 24, 0);

  return light;
};

const observeDebugCanvas = (canvas: HTMLCanvasElement, runtime: DebugRuntime): ResizeObserver => {
  const resizeObserver = new ResizeObserver(() => {
    resizeDebugRenderer(canvas, runtime);
  });

  resizeObserver.observe(canvas);
  resizeDebugRenderer(canvas, runtime);

  return resizeObserver;
};

const resizeDebugRenderer = (canvas: HTMLCanvasElement, runtime: DebugRuntime): void => {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  runtime.renderer.setSize(width, height, false);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
};

const startDebugAnimation = (
  runtime: DebugRuntime,
  onFrame?: (stats: ThreeChunkDebugFrameStats) => void,
): AnimationHandle => {
  let animationFrame = 0;
  let lastFrameTime = performance.now();
  let lastStatsTime = lastFrameTime;
  let stopped = false;

  const tick = (time: number) => {
    if (stopped) return;

    const frameMs = time - lastFrameTime;
    lastFrameTime = time;

    animateDebugScene(runtime, time);
    runtime.controls.update();
    runtime.renderer.render(runtime.scene, runtime.camera);
    publishFrameStats(runtime, time, frameMs, lastStatsTime, onFrame);

    if (time - lastStatsTime >= FRAME_STATS_INTERVAL_MS) {
      lastStatsTime = time;
    }

    animationFrame = requestAnimationFrame(tick);
  };

  animationFrame = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
    },
  };
};

const animateDebugScene = (runtime: DebugRuntime, time: number): void => {
  const pulse = Math.sin(time * 0.003) * 0.5 + 0.5;
  runtime.hotLight.intensity = 24 + pulse * 18;
  runtime.hotLight.position.x = Math.cos(time * 0.0006) * runtime.fixture.chunkSize;
  runtime.hotLight.position.z = Math.sin(time * 0.0006) * runtime.fixture.chunkSize;
};

const publishFrameStats = (
  runtime: DebugRuntime,
  time: number,
  frameMs: number,
  lastStatsTime: number,
  onFrame?: (stats: ThreeChunkDebugFrameStats) => void,
): void => {
  if (!onFrame || time - lastStatsTime < FRAME_STATS_INTERVAL_MS) return;

  onFrame({
    fps: Math.round(1000 / Math.max(frameMs, 1)),
    frameMs: Number(frameMs.toFixed(1)),
    renderedChunks: runtime.fixture.chunks.length,
    drawCalls: runtime.renderer.info.render.calls,
    triangles: runtime.renderer.info.render.triangles,
  });
};

const positionDebugCamera = (
  camera: THREE.PerspectiveCamera,
  controls: MapControls,
  fixture: DebugChunkFixture,
): void => {
  const width = fixture.worldBounds.maxX - fixture.worldBounds.minX;
  const depth = fixture.worldBounds.maxZ - fixture.worldBounds.minZ;
  const distance = Math.max(width, depth);

  camera.position.set(distance * 0.58, distance * 0.72, distance * 0.72);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
};

const destroyDebugRuntime = (runtime: DebugRuntime): void => {
  runtime.controls.dispose();
  runtime.scene.traverse(disposeDebugObject);
  runtime.renderer.dispose();
};

const disposeDebugObject = (object: THREE.Object3D): void => {
  if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
    object.geometry.dispose();
    disposeMaterial(object.material);
  }
};

const disposeMaterial = (material: THREE.Material | THREE.Material[]): void => {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
};

const buildChunkOutlinePoints = (bounds: {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}): THREE.Vector3[] => {
  const y = 0.22;
  const northWest = new THREE.Vector3(bounds.minX, y, bounds.minZ);
  const northEast = new THREE.Vector3(bounds.maxX, y, bounds.minZ);
  const southEast = new THREE.Vector3(bounds.maxX, y, bounds.maxZ);
  const southWest = new THREE.Vector3(bounds.minX, y, bounds.maxZ);

  return [northWest, northEast, northEast, southEast, southEast, southWest, southWest, northWest];
};

const CHUNK_HEIGHT_BY_HEAT: Record<DebugChunkHeat, number> = {
  cool: 0.08,
  warm: 0.14,
  hot: 0.24,
};

const CHUNK_COLOR_BY_HEAT: Record<DebugChunkHeat, number> = {
  cool: 0x4d88aa,
  warm: 0xe4d37c,
  hot: 0xff9f45,
};

const resolveChunkHeight = (heat: DebugChunkHeat): number => CHUNK_HEIGHT_BY_HEAT[heat];

const resolveChunkColor = (heat: DebugChunkHeat): number => CHUNK_COLOR_BY_HEAT[heat];
