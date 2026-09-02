import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { resolveWebGpuRendererActiveMode } from "@/three/webgpu-renderer-backend";
import { WebGPURenderer } from "three/webgpu";

import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { loadTerrainPropCatalog } from "@/three/terrain/terrain-prop-asset-cache";
import {
  TERRAIN_PROP_ARCHETYPE_IDS,
  getTerrainPropMeshName,
  type TerrainPropLod,
} from "@/three/terrain/terrain-prop-catalog";
import { configureGltfTextureSupport } from "@/three/utils/utils";

export interface TerrainPropDebugStats {
  activeMode: "webgl2-fallback" | "webgpu";
  drawCalls: number;
  triangles: number;
  visibleProps: number;
}

export interface TerrainPropDebugRendererHandle {
  dispose(): void;
  resetCamera(): void;
}

interface MountTerrainPropDebugRendererInput {
  canvas: HTMLCanvasElement;
  forceWebGL: boolean;
  lod: TerrainPropLod;
  onReady(stats: TerrainPropDebugStats): void;
}

interface TerrainPropDebugRuntime {
  camera: PerspectiveCamera;
  controls: MapControls;
  ownedObjects: Group;
  renderer: TerrainPropRendererSurface;
  scene: Scene;
}

interface TerrainPropRendererSurface extends RendererSurfaceLike {
  init(): Promise<void>;
  setAnimationLoop(callback: ((time: number) => void) | null): void;
  setClearColor(color: Color, alpha?: number): void;
}

type TerrainPropRendererConstructor = new (options: {
  antialias: boolean;
  canvas: HTMLCanvasElement;
  forceWebGL: boolean;
}) => TerrainPropRendererSurface;

type TerrainPropDebugWindow = Window & {
  __terrainPropDebug?: {
    status: "booting" | "error" | "ready";
    error?: string;
    getSnapshot?: () => TerrainPropDebugStats;
  };
};

const PROP_SPACING = 2.2;
const PROP_COLUMNS = 4;

export async function mountTerrainPropDebugRenderer(
  input: MountTerrainPropDebugRendererInput,
): Promise<TerrainPropDebugRendererHandle> {
  const debugWindow = window as TerrainPropDebugWindow;
  debugWindow.__terrainPropDebug = { status: "booting" };

  try {
    const runtime = await createTerrainPropDebugRuntime(input);
    const resizeObserver = observeCanvas(input.canvas, runtime);
    const stopAnimation = startAnimation(runtime);
    const stats = readStats(runtime, input.forceWebGL);
    debugWindow.__terrainPropDebug = {
      status: "ready",
      getSnapshot: () => readStats(runtime, input.forceWebGL),
    };
    input.onReady(stats);

    return {
      dispose: () => {
        stopAnimation();
        resizeObserver.disconnect();
        runtime.controls.dispose();
        disposeOwnedObjects(runtime.ownedObjects);
        runtime.renderer.dispose();
        delete debugWindow.__terrainPropDebug;
      },
      resetCamera: () => positionCamera(runtime.camera, runtime.controls),
    };
  } catch (error) {
    debugWindow.__terrainPropDebug = {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
    throw error;
  }
}

async function createTerrainPropDebugRuntime(
  input: MountTerrainPropDebugRendererInput,
): Promise<TerrainPropDebugRuntime> {
  const Renderer = WebGPURenderer as unknown as TerrainPropRendererConstructor;
  const renderer = new Renderer({
    canvas: input.canvas,
    antialias: true,
    forceWebGL: input.forceWebGL,
  });
  renderer.outputColorSpace = "srgb";
  renderer.setPixelRatio(1);
  renderer.setClearColor(new Color("#d8d1bd"), 1);
  renderer.shadowMap.enabled = true;
  await renderer.init();
  configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  const controls = new MapControls(camera, input.canvas);
  controls.enableDamping = false;
  controls.maxPolarAngle = Math.PI / 2.08;
  const ownedObjects = createOwnedDebugObjects();
  positionCamera(camera, controls);

  scene.add(ownedObjects);
  scene.add(createLights());
  scene.add(createGrid());
  const catalog = await loadTerrainPropCatalog();
  addCatalogProps(ownedObjects, catalog.scene, input.lod);
  renderer.render(scene, camera);

  return { camera, controls, ownedObjects, renderer, scene };
}

function addCatalogProps(target: Group, catalogScene: Group, lod: TerrainPropLod): void {
  TERRAIN_PROP_ARCHETYPE_IDS.forEach((archetype, index) => {
    const source = catalogScene.getObjectByName(getTerrainPropMeshName(archetype, lod));
    if (!(source instanceof Mesh)) {
      throw new Error(`Terrain prop mesh is not renderable: ${getTerrainPropMeshName(archetype, lod)}`);
    }

    const prop = new Mesh(source.geometry, source.material);
    prop.name = `debug:${archetype}:${lod}`;
    prop.position.copy(resolvePropPosition(index));
    prop.castShadow = true;
    prop.receiveShadow = true;
    target.add(prop);
  });
}

function createOwnedDebugObjects(): Group {
  const group = new Group();
  group.name = "terrain-prop-debug-owned";
  const ground = new Mesh(
    new PlaneGeometry(12, 9),
    new MeshStandardMaterial({ color: "#87936d", metalness: 0, roughness: 0.95 }),
  );
  ground.name = "terrain-prop-debug-ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  group.add(ground);
  return group;
}

function createLights(): Group {
  const lights = new Group();
  lights.add(new AmbientLight(0xdde7e9, 1.5));
  const sun = new DirectionalLight(0xfff2d0, 3.2);
  sun.position.set(5, 8, 6);
  sun.castShadow = true;
  lights.add(sun);
  return lights;
}

function createGrid(): GridHelper {
  const grid = new GridHelper(12, 12, 0x59624e, 0x9da58b);
  grid.position.y = 0;
  return grid;
}

function resolvePropPosition(index: number): Vector3 {
  const row = Math.floor(index / PROP_COLUMNS);
  const col = index % PROP_COLUMNS;
  return new Vector3((col - 1.5) * PROP_SPACING, 0, (row - 1) * PROP_SPACING);
}

function positionCamera(camera: PerspectiveCamera, controls: MapControls): void {
  camera.position.set(6.7, 6.2, 9.5);
  controls.target.set(0, 0.45, 0);
  camera.lookAt(controls.target);
  controls.update();
}

function observeCanvas(canvas: HTMLCanvasElement, runtime: TerrainPropDebugRuntime): ResizeObserver {
  const observer = new ResizeObserver(() => resizeRenderer(canvas, runtime));
  observer.observe(canvas);
  resizeRenderer(canvas, runtime);
  return observer;
}

function resizeRenderer(canvas: HTMLCanvasElement, runtime: TerrainPropDebugRuntime): void {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(bounds.width));
  const height = Math.max(1, Math.floor(bounds.height));
  runtime.renderer.setSize(width, height);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
}

function startAnimation(runtime: TerrainPropDebugRuntime): () => void {
  runtime.renderer.setAnimationLoop(() => {
    runtime.controls.update();
    runtime.renderer.render(runtime.scene, runtime.camera);
  });
  return () => runtime.renderer.setAnimationLoop(null);
}

function readStats(runtime: TerrainPropDebugRuntime, forceWebGL: boolean): TerrainPropDebugStats {
  const renderInfo = runtime.renderer.info.render;
  return {
    activeMode: resolveWebGpuRendererActiveMode(runtime.renderer),
    drawCalls: renderInfo.drawCalls ?? renderInfo.calls,
    triangles: renderInfo.triangles,
    visibleProps: TERRAIN_PROP_ARCHETYPE_IDS.length,
  };
}

function disposeOwnedObjects(group: Group): void {
  const ground = group.getObjectByName("terrain-prop-debug-ground");
  if (ground instanceof Mesh) {
    ground.geometry.dispose();
    const materials = Array.isArray(ground.material) ? ground.material : [ground.material];
    materials.forEach((material) => material.dispose());
  }
  group.clear();
}
