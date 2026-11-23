import {
  AmbientLight,
  Box3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { clone as cloneWithSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { WebGPURenderer } from "three/webgpu";

import { T1_KNIGHT_WORLD_SCALE } from "@/three/constants/army-constants";
import { fetchModel, modelPath } from "@/three/utils/model-url";
import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { configureRendererColorOutput } from "@/three/renderer-color-output";
import { loadBiomeCreature } from "@/three/terrain/creatures/biome-creature-assets";
import {
  creatureForBiome,
  creatureTraits,
  homeBiome,
  type CreatureSpecies,
} from "@/three/terrain/creatures/biome-creature-catalog";
import { findNearestTerrainHex, terrainCellKey, terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import { TERRAIN_BIOME_DESCRIPTORS, TERRAIN_BIOME_ORDER } from "@/three/terrain/terrain-palette";
import { LAYER_BIOME_LOOKS } from "@/three/terrain/layer-biomes";
import {
  TERRAIN_FLORA_MANIFEST_PATH,
  TERRAIN_PROP_ARCHETYPE_IDS,
  getTerrainPropRole,
  isLayerPropId,
  type TerrainPropArchetypeId,
} from "@/three/terrain/terrain-prop-catalog";
import { TerrainPropPools } from "@/three/terrain/terrain-prop-pools";
import { getLayerPropBiomes, getTerrainPropBiomes, resolveLayerFloraAppearance } from "@/three/terrain/terrain-props";
import type {
  TerrainCellInput,
  TerrainPropAppearance,
  TerrainPropInstance,
  TerrainSurfaceSample,
} from "@/three/terrain/terrain-types";
import { isTerrainWaterBiome, TERRAIN_WATER_LEVEL } from "@/three/terrain/terrain-water";
import { TerrainWildlife } from "@/three/terrain/terrain-wildlife";
import { gltfLoader } from "@/three/utils/gltf-loader";
import { configureGltfTextureSupport } from "@/three/utils/utils";
import { resolveWebGpuRendererActiveMode } from "@/three/webgpu-renderer-backend";
import type { BiomeType } from "@bibliothecadao/types/terrain";

export type MapLifeGround = "neutral" | "biome";
export type WildlifeLabCameraView = "flank" | "map";

export interface MapLifeLabStats {
  activeMode: "webgl2-fallback" | "webgpu";
  drawCalls: number;
  tiles: number;
  triangles: number;
}

export interface MapLifeLabHandle {
  dispose(): void;
  resetCamera(): void;
}

interface MountMapLifeLabInput {
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  forceWebGL: boolean;
  ground: MapLifeGround;
  onReady(stats: MapLifeLabStats): void;
}

interface WildlifeLabStats {
  activeMode: "webgl2-fallback" | "webgpu";
  wildlife: ReturnType<TerrainWildlife["getStats"]>;
}

export interface WildlifeLabHandle {
  dispose(): void;
  getStats(): WildlifeLabStats;
}

interface MountWildlifeLabInput {
  cameraDistance: number;
  cameraView: WildlifeLabCameraView;
  canvas: HTMLCanvasElement;
  captureMode: boolean;
  forceWebGL: boolean;
  species: CreatureSpecies | null;
  army: boolean;
  onReady(stats: WildlifeLabStats): void;
}

interface LabRendererSurface extends RendererSurfaceLike {
  init(): Promise<void>;
  setAnimationLoop(callback: ((time: number) => void) | null): void;
  setClearColor(color: Color, alpha?: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
}

type LabRendererConstructor = new (options: {
  antialias: boolean;
  canvas: HTMLCanvasElement;
  forceWebGL: boolean;
}) => LabRendererSurface;

interface GalleryRuntime {
  camera: PerspectiveCamera;
  controls: OrbitControls;
  labels: CSS2DRenderer;
  renderer: LabRendererSurface;
  pools: TerrainPropPools | null;
  scene: Scene;
  tiles: number;
}

interface PaddockRuntime {
  army: LabArmy | null;
  camera: PerspectiveCamera;
  ground: Group;
  renderer: LabRendererSurface;
  scene: Scene;
  wildlife: TerrainWildlife;
}

interface LabArmy {
  marker: Group;
  heading: number;
  remaining: number;
}

interface FloraManifest {
  species: { id: string; bytes: number; height: number; triangles: number[] }[];
}

interface CreatureManifest {
  creatures: { id: string; file: string; triangles: number; bytes: number }[];
}

type WildlifeLabWindow = Window & {
  __wildlifeLab?: {
    status: "booting" | "error" | "ready";
    error?: string;
    getSnapshot?: () => WildlifeLabStats;
    step?: (seconds: number) => WildlifeLabStats;
  };
};

const CREATURE_MANIFEST_PATH = modelPath("biome-creatures/manifest.json");
const KNIGHT_PATH = modelPath("characters/t1-knight-default/near/skin.glb");
const FLORA_SLOT = 3.4;
const CREATURE_SLOT = 2.6;
const CREATURE_ROW_Z = -4.5;
const NEUTRAL_GROUND = "#8f8c84";
const PROCEDURAL = "procedural (build-time)";
const GALLERY_PAGE = "life-lab";
const PADDOCK_CELLS = 8;
const PADDOCK_COLUMNS = 4;
const FRAME_SECONDS = 1 / 30;
const WATER_BED_DEPTH = 0.3;
const MAP_CAMERA_DIRECTION = new Vector3(0, 0.77, 0.64).normalize();
const ARMY_PACE = 0.5;
const ARMY_MARCH = 11;
const SURFACE_GALLERY_LOOK: TerrainPropAppearance = {
  glow: [0, 0, 0],
  moss: 0,
  snow: 0,
  tint: [1, 1, 1],
  windAmplitude: 0.3,
};

export const WILDLIFE_LAB_SPECIES = TERRAIN_BIOME_ORDER.map((biome) => creatureForBiome(biome)).filter(
  (species) => species !== null,
);

async function createLabRenderer(
  canvas: HTMLCanvasElement,
  forceWebGL: boolean,
  clearHex: string,
  shadows: boolean,
): Promise<LabRendererSurface> {
  const Renderer = WebGPURenderer as unknown as LabRendererConstructor;
  const renderer = new Renderer({ canvas, antialias: true, forceWebGL });
  configureRendererColorOutput(renderer);
  renderer.setPixelRatio(1);
  renderer.setSize(...canvasSize(canvas), false);
  renderer.setClearColor(new Color(clearHex), 1);
  if (shadows) renderer.shadowMap.enabled = true;
  await renderer.init();
  configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);
  return renderer;
}

function createLabLights(shadows: boolean): Group {
  const lights = new Group();
  lights.add(new AmbientLight(0xdde7e9, shadows ? 1.4 : 1.5));
  const sun = new DirectionalLight(0xfff2d0, shadows ? 3 : 3.2);
  if (shadows) {
    sun.position.set(-20, 30, 20);
    sun.target.position.set(20, 0, -2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 1024);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 12, bottom: -12, near: 1, far: 120 });
    lights.add(sun, sun.target);
  } else {
    sun.position.set(5, 8, 6);
    lights.add(sun);
  }
  return lights;
}

function canvasSize(canvas: HTMLCanvasElement): [width: number, height: number] {
  const bounds = canvas.getBoundingClientRect();
  return [Math.max(1, Math.floor(bounds.width)), Math.max(1, Math.floor(bounds.height))];
}

function resizeSurface(
  canvas: HTMLCanvasElement,
  renderer: LabRendererSurface,
  camera: PerspectiveCamera,
  labels?: CSS2DRenderer,
): void {
  const [width, height] = canvasSize(canvas);
  renderer.setSize(width, height, false);
  labels?.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

export async function mountMapLifeLab(input: MountMapLifeLabInput): Promise<MapLifeLabHandle> {
  const renderer = await createLabRenderer(input.canvas, input.forceWebGL, "#20241f", true);
  const labels = new CSS2DRenderer({ element: input.labels });
  const camera = new PerspectiveCamera(36, 1, 0.05, 400);
  const controls = new OrbitControls(camera, input.labels);
  controls.enableDamping = false;
  const scene = new Scene();
  scene.add(createLabLights(true));
  const runtime: GalleryRuntime = { camera, controls, labels, pools: null, renderer, scene, tiles: 0 };
  frameGalleryCamera(runtime);

  const knight = await loadKnight();
  const floraTiles = await addFloraRow(runtime, input, knight);
  const creatureTiles = await addCreatureRow(runtime.scene, input, knight);
  runtime.tiles = floraTiles + creatureTiles;
  const resize = () => resizeSurface(input.canvas, runtime.renderer, runtime.camera, runtime.labels);
  const observer = new ResizeObserver(resize);
  observer.observe(input.canvas);
  resize();
  runtime.renderer.setAnimationLoop(() => drawGallery(runtime));
  drawGallery(runtime);
  input.onReady(readGalleryStats(runtime));
  return {
    dispose: () => {
      runtime.renderer.setAnimationLoop(null);
      observer.disconnect();
      runtime.controls.dispose();
      runtime.labels.domElement.replaceChildren();
      runtime.pools?.dispose();
      runtime.scene.clear();
      runtime.renderer.dispose();
    },
    resetCamera: () => frameGalleryCamera(runtime),
  };
}

export async function mountWildlifeLab(input: MountWildlifeLabInput): Promise<WildlifeLabHandle> {
  const labWindow = window as WildlifeLabWindow;
  labWindow.__wildlifeLab = { status: "booting" };
  try {
    const renderer = await createLabRenderer(input.canvas, input.forceWebGL, "#1c1917", false);
    const cells = createPaddockCells();
    const biomes = new Map(cells.map((cell) => [terrainCellKey(cell.col, cell.row), cell.biome]));
    const wildlife = new TerrainWildlife(
      (x, z) => samplePaddockSurface(biomes, x, z),
      () => {},
    );
    wildlife.sync(cells, []);
    await wildlife.load();

    const scene = new Scene();
    const ground = createPaddockGround(cells);
    scene.add(ground, wildlife.object3d, createLabLights(false));
    const army = input.army && input.species ? createLabArmy() : null;
    if (army) scene.add(army.marker);
    const runtime: PaddockRuntime = {
      army,
      camera: new PerspectiveCamera(36, 1, 0.05, 300),
      ground,
      renderer,
      scene,
      wildlife,
    };

    const draw = () => drawPaddockFrame(runtime, input);
    const resize = () => resizeSurface(input.canvas, runtime.renderer, runtime.camera);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(input.canvas);
    resize();
    const tick = (seconds: number) => advancePaddock(runtime, input, seconds);
    const stopAnimation = startPaddockAnimation(runtime, draw, input.captureMode ? () => {} : tick);
    labWindow.__wildlifeLab = {
      status: "ready",
      getSnapshot: () => readPaddockStats(runtime),
      step: (seconds) => {
        for (let remaining = seconds; remaining > 1e-6; remaining -= FRAME_SECONDS)
          tick(Math.min(FRAME_SECONDS, remaining));
        return readPaddockStats(runtime);
      },
    };
    input.onReady(readPaddockStats(runtime));
    return {
      getStats: () => readPaddockStats(runtime),
      dispose: () => {
        stopAnimation();
        resizeObserver.disconnect();
        runtime.wildlife.dispose();
        disposePaddockGround(runtime.ground);
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

async function addFloraRow(runtime: GalleryRuntime, input: MountMapLifeLabInput, knight: Object3D) {
  const pools = await TerrainPropPools.load();
  runtime.pools = pools;
  runtime.scene.add(pools.object3d);
  const manifest = (await fetchJson(TERRAIN_FLORA_MANIFEST_PATH)) as FloraManifest;
  pools.writePage(
    GALLERY_PAGE,
    TERRAIN_PROP_ARCHETYPE_IDS.map((archetype, index) => galleryInstance(archetype, index * FLORA_SLOT)),
  );
  TERRAIN_PROP_ARCHETYPE_IDS.forEach((archetype, index) => {
    const x = index * FLORA_SLOT;
    const row = manifest.species.find(({ id }) => id === archetype)!;
    const draws = getTerrainPropRole(archetype) === "canopy" ? "1 draw per kind, +1 shadow" : "1 draw per kind";
    runtime.scene.add(createGalleryGround(x, 0, FLORA_SLOT * 0.48, floraGroundColour(input.ground, archetype)));
    const anchor = new Object3D();
    anchor.position.set(x, 0, 0);
    runtime.scene.add(anchor);
    labelTile(anchor, row.height, archetype, PROCEDURAL, row.triangles[0], `${Math.round(row.bytes / 1024)} KB`, draws);
    runtime.scene.add(placeKnight(knight, x + 0.9, 0.9));
  });
  return TERRAIN_PROP_ARCHETYPE_IDS.length;
}

function galleryInstance(archetype: TerrainPropArchetypeId, x: number): TerrainPropInstance {
  return {
    appearance: isLayerPropId(archetype)
      ? resolveLayerFloraAppearance(getLayerPropBiomes(archetype)[0], 1)
      : SURFACE_GALLERY_LOOK,
    archetype,
    ownerCol: 0,
    ownerRow: 0,
    pageKey: GALLERY_PAGE,
    scale: 1,
    worldX: x,
    worldY: 0,
    worldZ: 0,
    yaw: 0,
  };
}

function floraGroundColour(ground: MapLifeGround, archetype: TerrainPropArchetypeId): string {
  if (ground === "biome" && isLayerPropId(archetype)) return LAYER_BIOME_LOOKS[getLayerPropBiomes(archetype)[0]].ground;
  return groundColour(ground, getTerrainPropBiomes(archetype)[0]);
}

async function addCreatureRow(scene: Scene, input: MountMapLifeLabInput, knight: Object3D) {
  const manifest = (await fetchJson(CREATURE_MANIFEST_PATH)) as CreatureManifest;
  await Promise.all(
    manifest.creatures.map(async (creature, index) => {
      const x = index * CREATURE_SLOT;
      scene.add(
        createGalleryGround(
          x,
          CREATURE_ROW_Z,
          CREATURE_SLOT * 0.46,
          groundColour(input.ground, homeBiome(creature.id as CreatureSpecies)),
        ),
      );
      const animal = await loadBiomeCreature(creature.id as CreatureSpecies, () => {});
      animal.position.set(x - 0.35, 0, CREATURE_ROW_Z);
      scene.add(animal);
      const meshes = countMeshes(animal);
      labelTile(
        animal,
        objectTop(animal),
        creature.id,
        PROCEDURAL,
        creature.triangles,
        `${Math.round(creature.bytes / 1024)} KB`,
        `${meshes} ${meshes === 1 ? "draw" : "draws"} per animal`,
      );
      scene.add(placeKnight(knight, x + 0.65, CREATURE_ROW_Z));
    }),
  );
  return manifest.creatures.length;
}

async function loadKnight(): Promise<Object3D> {
  const { scene } = await gltfLoader.loadAsync(KNIGHT_PATH);
  scene.scale.setScalar(T1_KNIGHT_WORLD_SCALE);
  const bounds = new Box3().setFromObject(scene);
  scene.position.y = -bounds.min.y;
  enableShadows(scene);
  const holder = new Group();
  holder.name = "map-life-army-scale";
  holder.add(scene);
  return holder;
}

function placeKnight(knight: Object3D, x: number, z: number): Object3D {
  const copy = cloneWithSkeleton(knight);
  copy.position.set(x, 0, z);
  return copy;
}

function labelTile(
  object: Object3D,
  top: number,
  name: string,
  kind: string,
  triangles: number,
  size: string,
  draws: string,
) {
  const element = document.createElement("div");
  element.className = "rounded bg-black/70 px-2 py-1 text-[11px] leading-tight text-white";
  element.innerHTML = `<b>${name}</b><br>${kind}<br>${triangles.toLocaleString()} tris · ${size}<br>${draws}`;
  const label = new CSS2DObject(element);
  label.position.set(0, top + 0.2, 0);
  object.add(label);
}

function objectTop(object: Object3D): number {
  const bounds = new Box3().setFromObject(object);
  return (bounds.max.y - object.position.y) / Math.max(object.scale.y, 1e-6);
}

function createGalleryGround(x: number, z: number, radius: number, colour: string): Mesh {
  const ground = new Mesh(
    new CylinderGeometry(radius, radius, 0.06, 6),
    new MeshStandardMaterial({ color: colour, roughness: 0.95 }),
  );
  ground.position.set(x, -0.03, z);
  ground.receiveShadow = true;
  return ground;
}

function groundColour(ground: MapLifeGround, biome: BiomeType | undefined): string {
  if (ground === "neutral" || !biome) return NEUTRAL_GROUND;
  return TERRAIN_BIOME_DESCRIPTORS[biome].primary;
}

function frameGalleryCamera({ camera, controls }: Pick<GalleryRuntime, "camera" | "controls">) {
  camera.position.set(2, 7, 9);
  controls.target.set(2, 0.4, -1.5);
  controls.update();
}

function drawGallery(runtime: GalleryRuntime) {
  runtime.controls.update();
  runtime.renderer.render(runtime.scene, runtime.camera);
  runtime.labels.render(runtime.scene, runtime.camera);
}

function readGalleryStats(runtime: GalleryRuntime): MapLifeLabStats {
  const info = runtime.renderer.info.render;
  return {
    activeMode: resolveWebGpuRendererActiveMode(runtime.renderer),
    drawCalls: info.drawCalls ?? info.calls,
    tiles: runtime.tiles,
    triangles: info.triangles,
  };
}

function enableShadows(object: Object3D) {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function countMeshes(object: Object3D): number {
  let meshes = 0;
  object.traverse((child) => {
    if (child instanceof Mesh) meshes += 1;
  });
  return meshes;
}

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetchModel(path);
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response.json();
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

function createPaddockGround(cells: readonly TerrainCellInput[]): Group {
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

function startPaddockAnimation(runtime: PaddockRuntime, draw: () => void, tick: (seconds: number) => void): () => void {
  let last = performance.now();
  runtime.renderer.setAnimationLoop((now) => {
    tick((now - last) / 1000);
    last = now;
    draw();
  });
  return () => runtime.renderer.setAnimationLoop(null);
}

function advancePaddock(runtime: PaddockRuntime, input: MountWildlifeLabInput, seconds: number): void {
  const followed = input.species ? findAnimal(runtime.wildlife, input.species) : undefined;
  if (runtime.army && followed) {
    marchPast(runtime.army, followed.position, seconds);
    const { x, z } = runtime.army.marker.position;
    runtime.wildlife.setArmies([{ worldX: x, worldZ: z, isMoving: true }]);
  }
  runtime.wildlife.update(seconds);
}

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

function drawPaddockFrame(runtime: PaddockRuntime, input: MountWildlifeLabInput): void {
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

function readPaddockStats(runtime: PaddockRuntime): WildlifeLabStats {
  return { activeMode: resolveWebGpuRendererActiveMode(runtime.renderer), wildlife: runtime.wildlife.getStats() };
}

function disposePaddockGround(ground: Group): void {
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
