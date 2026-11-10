import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import { WebGPURenderer } from "three/webgpu";

import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { configureRendererColorOutput } from "@/three/renderer-color-output";
import {
  creatureForBiome,
  creatureTraits,
  type CreatureSpecies,
} from "@/three/terrain/creatures/biome-creature-catalog";
import { findNearestTerrainHex, terrainCellKey, terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import { TERRAIN_BIOME_DESCRIPTORS, TERRAIN_BIOME_ORDER } from "@/three/terrain/terrain-palette";
import type { TerrainCellInput, TerrainSurfaceSample } from "@/three/terrain/terrain-types";
import { isTerrainWaterBiome, TERRAIN_WATER_LEVEL } from "@/three/terrain/terrain-water";
import { TerrainWildlife } from "@/three/terrain/terrain-wildlife";
import { configureGltfTextureSupport } from "@/three/utils/utils";
import { resolveWebGpuRendererActiveMode } from "@/three/webgpu-renderer-backend";

/** How the camera looks at the followed animal: from its flank, or from the south as the world map's camera does. */
export type WildlifeLabCameraView = "flank" | "map";

interface WildlifeLabStats {
  activeMode: "webgl2-fallback" | "webgpu";
  wildlife: ReturnType<TerrainWildlife["getStats"]>;
}

export interface WildlifeLabHandle {
  dispose(): void;
  getStats(): WildlifeLabStats;
}

interface MountWildlifeLabInput {
  /** How far the camera stands from the followed animal: the map's view in world units, the flank's in the animal's own sizes. */
  cameraDistance: number;
  cameraView: WildlifeLabCameraView;
  canvas: HTMLCanvasElement;
  /** Holds the clock still: the page advances only through `window.__wildlifeLab.step`. */
  captureMode: boolean;
  forceWebGL: boolean;
  /** The species the camera follows; none shows every paddock. */
  species: CreatureSpecies | null;
  /** Marches a stand-in army past the followed animal, again and again, to show how it takes it. */
  army: boolean;
  onReady(stats: WildlifeLabStats): void;
}

interface WildlifeLabRuntime {
  army: LabArmy | null;
  camera: PerspectiveCamera;
  ground: Group;
  renderer: WildlifeLabRendererSurface;
  scene: Scene;
  wildlife: TerrainWildlife;
}

interface WildlifeLabRendererSurface extends RendererSurfaceLike {
  init(): Promise<void>;
  setAnimationLoop(callback: ((time: number) => void) | null): void;
  setClearColor(color: Color, alpha?: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
}

type WildlifeLabRendererConstructor = new (options: {
  antialias: boolean;
  canvas: HTMLCanvasElement;
  forceWebGL: boolean;
}) => WildlifeLabRendererSurface;

type WildlifeLabWindow = Window & {
  __wildlifeLab?: {
    status: "booting" | "error" | "ready";
    error?: string;
    getSnapshot?: () => WildlifeLabStats;
    /** Advances the animals by `seconds` in frame-sized steps, for the next frame to draw: a capture's only clock. */
    step?: (seconds: number) => WildlifeLabStats;
  };
};

/** One paddock per biome, each as wide as the population's region, so the real population puts one native in each. */
const PADDOCK_CELLS = 8;
const PADDOCK_COLUMNS = 4;
const FRAME_SECONDS = 1 / 30;
const WATER_BED_DEPTH = 0.3;
/** From the south and above, as the world map looks at its tiles. */
const MAP_CAMERA_DIRECTION = new Vector3(0, 0.77, 0.64).normalize();

export async function mountWildlifeLab(input: MountWildlifeLabInput): Promise<WildlifeLabHandle> {
  const labWindow = window as WildlifeLabWindow;
  labWindow.__wildlifeLab = { status: "booting" };
  try {
    const runtime = await createRuntime(input);
    const draw = () => drawFrame(runtime, input);
    const resizeObserver = new ResizeObserver(() => resizeRenderer(input.canvas, runtime));
    resizeObserver.observe(input.canvas);
    resizeRenderer(input.canvas, runtime);
    const tick = (seconds: number) => advanceLab(runtime, input, seconds);
    const stopAnimation = startAnimation(runtime, draw, input.captureMode ? () => {} : tick);
    labWindow.__wildlifeLab = {
      status: "ready",
      getSnapshot: () => readStats(runtime),
      step: (seconds) => {
        for (let remaining = seconds; remaining > 1e-6; remaining -= FRAME_SECONDS)
          tick(Math.min(FRAME_SECONDS, remaining));
        return readStats(runtime);
      },
    };
    input.onReady(readStats(runtime));
    return {
      getStats: () => readStats(runtime),
      dispose: () => {
        stopAnimation();
        resizeObserver.disconnect();
        runtime.wildlife.dispose();
        disposeGround(runtime.ground);
        if (runtime.army) disposeArmy(runtime.army);
        runtime.renderer.dispose();
        delete labWindow.__wildlifeLab;
      },
    };
  } catch (error) {
    labWindow.__wildlifeLab = { status: "error", error: error instanceof Error ? error.message : String(error) };
    throw error;
  }
}

async function createRuntime(input: MountWildlifeLabInput): Promise<WildlifeLabRuntime> {
  const Renderer = WebGPURenderer as unknown as WildlifeLabRendererConstructor;
  const renderer = new Renderer({ canvas: input.canvas, antialias: true, forceWebGL: input.forceWebGL });
  configureRendererColorOutput(renderer);
  renderer.setPixelRatio(1);
  // Sized before anything is compiled or drawn, as the terrain lab is: a first frame at the canvas's default size
  // leaves a depth buffer that never matches the resized one.
  renderer.setSize(...canvasSize(input.canvas), false);
  renderer.setClearColor(new Color("#1c1917"), 1);
  await renderer.init();
  configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);

  const cells = createPaddockCells();
  const biomes = new Map(cells.map((cell) => [terrainCellKey(cell.col, cell.row), cell.biome]));
  const wildlife = new TerrainWildlife(
    (x, z) => samplePaddockSurface(biomes, x, z),
    () => {},
  );
  wildlife.sync(cells, []);
  await wildlife.load();

  const scene = new Scene();
  const ground = createGround(cells);
  scene.add(ground, wildlife.object3d, createLights());
  const army = input.army && input.species ? createLabArmy() : null;
  if (army) scene.add(army.marker);
  return { army, camera: new PerspectiveCamera(36, 1, 0.05, 300), ground, renderer, scene, wildlife };
}

function createPaddockCells(): TerrainCellInput[] {
  return TERRAIN_BIOME_ORDER.flatMap((biome, paddock) => {
    const firstCol = (paddock % PADDOCK_COLUMNS) * PADDOCK_CELLS;
    const firstRow = Math.floor(paddock / PADDOCK_COLUMNS) * PADDOCK_CELLS;
    return Array.from({ length: PADDOCK_CELLS * PADDOCK_CELLS }, (_, index) => ({
      biome,
      col: firstCol + (index % PADDOCK_CELLS),
      row: firstRow + Math.floor(index / PADDOCK_CELLS),
      explored: true,
      occupied: false,
      previewBiome: null,
    }));
  });
}

function samplePaddockSurface(
  biomes: ReadonlyMap<string, TerrainCellInput["biome"]>,
  x: number,
  z: number,
): TerrainSurfaceSample {
  const hex = findNearestTerrainHex(x, z);
  const biome = biomes.get(terrainCellKey(hex.col, hex.row)) ?? null;
  return { biome, height: isTerrainWaterBiome(biome) ? TERRAIN_WATER_LEVEL - WATER_BED_DEPTH : 0, normal: [0, 1, 0] };
}

/** Flat hex tiles in each biome's colour: their one-hex spacing is the yardstick an animal's size is read against. */
function createGround(cells: readonly TerrainCellInput[]): Group {
  const ground = new Group();
  ground.name = "wildlife-lab-ground";
  const tile = new CylinderGeometry(0.97, 0.97, 0.04, 6);
  const land = new InstancedMesh(tile, new MeshStandardMaterial({ roughness: 0.95 }), cells.length);
  const waterCells = cells.filter((cell) => isTerrainWaterBiome(cell.biome));
  const water = new InstancedMesh(
    tile,
    new MeshStandardMaterial({ color: "#4f9fb5", opacity: 0.55, roughness: 0.2, transparent: true }),
    waterCells.length,
  );
  const matrix = new Matrix4();
  const colour = new Color();
  cells.forEach((cell, index) => {
    const { x, z } = terrainHexToWorld(cell.col, cell.row);
    const bed = isTerrainWaterBiome(cell.biome) ? TERRAIN_WATER_LEVEL - WATER_BED_DEPTH : 0;
    land.setMatrixAt(index, matrix.makeTranslation(x, bed - 0.02, z));
    land.setColorAt(index, colour.set(TERRAIN_BIOME_DESCRIPTORS[cell.biome!].primary));
  });
  waterCells.forEach((cell, index) => {
    const { x, z } = terrainHexToWorld(cell.col, cell.row);
    water.setMatrixAt(index, matrix.makeTranslation(x, TERRAIN_WATER_LEVEL - 0.02, z));
  });
  ground.add(land, water);
  return ground;
}

function createLights(): Group {
  const lights = new Group();
  lights.add(new AmbientLight(0xdde7e9, 1.5));
  const sun = new DirectionalLight(0xfff2d0, 3.2);
  sun.position.set(5, 8, 6);
  lights.add(sun);
  return lights;
}

/**
 * Draws every frame, and lets the clock run unless a capture holds it. A held page still draws from the renderer's own
 * loop: a skinned animal's bones reach the GPU once per frame of that loop, so a draw made outside it shows a stale
 * pose.
 */
function startAnimation(runtime: WildlifeLabRuntime, draw: () => void, tick: (seconds: number) => void): () => void {
  let last = performance.now();
  runtime.renderer.setAnimationLoop((now) => {
    tick((now - last) / 1000);
    last = now;
    draw();
  });
  return () => runtime.renderer.setAnimationLoop(null);
}

function advanceLab(runtime: WildlifeLabRuntime, input: MountWildlifeLabInput, seconds: number): void {
  const followed = input.species ? findAnimal(runtime.wildlife, input.species) : undefined;
  if (runtime.army && followed) {
    marchPast(runtime.army, followed.position, seconds);
    const { x, z } = runtime.army.marker.position;
    runtime.wildlife.setArmies([{ worldX: x, worldZ: z, isMoving: true }]);
  }
  runtime.wildlife.update(seconds);
}

/** A stand-in for an army on the march: a banner on a post, walking straight lines past whatever the lab follows. */
interface LabArmy {
  marker: Group;
  heading: number;
  /** World units left of this march; a new one starts from a new side when it runs out. */
  remaining: number;
}

const ARMY_PACE = 0.5;
const ARMY_MARCH = 11;

function createLabArmy(): LabArmy {
  const marker = new Group();
  marker.name = "wildlife-lab-army";
  const post = new Mesh(new CylinderGeometry(0.04, 0.04, 0.9, 8), new MeshStandardMaterial({ color: "#3b2f2a" }));
  post.position.y = 0.45;
  const banner = new Mesh(new CylinderGeometry(0.2, 0.2, 0.3, 3), new MeshStandardMaterial({ color: "#b3261e" }));
  banner.position.y = 0.8;
  marker.add(post, banner);
  return { marker, heading: 0.6, remaining: 0 };
}

/** Marches on; at a march's end, starts the next half a march short of the animal, from another side. */
function marchPast(army: LabArmy, animal: Vector3, seconds: number): void {
  if (army.remaining <= 0) {
    army.heading += 2.2;
    army.remaining = ARMY_MARCH;
    army.marker.position.set(
      animal.x - Math.sin(army.heading) * ARMY_MARCH * 0.5,
      0,
      animal.z - Math.cos(army.heading) * ARMY_MARCH * 0.5,
    );
  }
  const step = Math.min(ARMY_PACE * seconds, army.remaining);
  army.marker.position.x += Math.sin(army.heading) * step;
  army.marker.position.z += Math.cos(army.heading) * step;
  army.remaining -= step;
}

function drawFrame(runtime: WildlifeLabRuntime, input: MountWildlifeLabInput): void {
  const followed = input.species ? findAnimal(runtime.wildlife, input.species) : undefined;
  if (followed) followAnimal(runtime.camera, followed, input);
  else frameEveryPaddock(runtime.camera);
  runtime.renderer.render(runtime.scene, runtime.camera);
}

function findAnimal(wildlife: TerrainWildlife, species: CreatureSpecies) {
  return wildlife.object3d.children.find((animal) => animal.name.startsWith(`biome-creature:${species}:`));
}

function followAnimal(
  camera: PerspectiveCamera,
  animal: Group["children"][number],
  input: MountWildlifeLabInput,
): void {
  const size = creatureTraits(input.species!).size;
  const target = animal.position.clone().setY(animal.position.y + size * 0.4);
  if (input.cameraView === "map") {
    camera.position.copy(target).addScaledVector(MAP_CAMERA_DIRECTION, input.cameraDistance);
  } else {
    const flank = new Vector3(1, 0, 0.25).applyQuaternion(animal.quaternion).setY(0.22).normalize();
    camera.position.copy(target).addScaledVector(flank, input.cameraDistance * size);
  }
  camera.lookAt(target);
}

function frameEveryPaddock(camera: PerspectiveCamera): void {
  const span = PADDOCK_COLUMNS * PADDOCK_CELLS;
  const centre = terrainHexToWorld(span / 2, span / 2);
  camera.position.set(centre.x, 62, centre.z + 44);
  camera.lookAt(centre.x, 0, centre.z);
}

function canvasSize(canvas: HTMLCanvasElement): [width: number, height: number] {
  const bounds = canvas.getBoundingClientRect();
  return [Math.max(1, Math.floor(bounds.width)), Math.max(1, Math.floor(bounds.height))];
}

function resizeRenderer(canvas: HTMLCanvasElement, runtime: WildlifeLabRuntime): void {
  const [width, height] = canvasSize(canvas);
  runtime.renderer.setSize(width, height, false);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
}

function readStats(runtime: WildlifeLabRuntime): WildlifeLabStats {
  return { activeMode: resolveWebGpuRendererActiveMode(runtime.renderer), wildlife: runtime.wildlife.getStats() };
}

function disposeGround(ground: Group): void {
  for (const tiles of ground.children as InstancedMesh[]) {
    tiles.geometry.dispose();
    (tiles.material as MeshStandardMaterial).dispose();
    tiles.dispose();
  }
  ground.clear();
}

function disposeArmy(army: LabArmy): void {
  for (const part of army.marker.children as Mesh[]) {
    part.geometry.dispose();
    (part.material as MeshStandardMaterial).dispose();
  }
}

/** The species the lab can follow: each biome's native, in the paddocks' order. */
export const WILDLIFE_LAB_SPECIES = TERRAIN_BIOME_ORDER.map((biome) => creatureForBiome(biome)).filter(
  (species) => species !== null,
);
