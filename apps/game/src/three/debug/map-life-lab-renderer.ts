import {
  AmbientLight,
  Box3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { clone as cloneWithSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { WebGPURenderer } from "three/webgpu";

import { T1_KNIGHT_WORLD_SCALE } from "@/three/constants/army-constants";
import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { configureRendererColorOutput } from "@/three/renderer-color-output";
import { loadBiomeCreature } from "@/three/terrain/creatures/biome-creature-assets";
import { homeBiome, type CreatureSpecies } from "@/three/terrain/creatures/biome-creature-catalog";
import { TERRAIN_BIOME_DESCRIPTORS } from "@/three/terrain/terrain-palette";
import { LAYER_BIOME_LOOKS } from "@/three/terrain/layer-biomes";
import {
  LAYER_PROP_IDS,
  TERRAIN_FLORA_MANIFEST_PATH,
  TERRAIN_PROP_ARCHETYPE_IDS,
  getTerrainPropRole,
  type LayerPropId,
  type TerrainPropArchetypeId,
} from "@/three/terrain/terrain-prop-catalog";
import { TerrainPropPools } from "@/three/terrain/terrain-prop-pools";
import { getLayerPropBiomes, getTerrainPropBiomes, resolveLayerFloraAppearance } from "@/three/terrain/terrain-props";
import type { TerrainPropAppearance, TerrainPropInstance } from "@/three/terrain/terrain-types";
import { gltfLoader } from "@/three/utils/gltf-loader";
import { configureGltfTextureSupport } from "@/three/utils/utils";
import { resolveWebGpuRendererActiveMode } from "@/three/webgpu-renderer-backend";
import type { BiomeType } from "@bibliothecadao/types/terrain";

export type MapLifeGround = "neutral" | "biome";

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

interface MapLifeRendererSurface extends RendererSurfaceLike {
  init(): Promise<void>;
  setAnimationLoop(callback: ((time: number) => void) | null): void;
  setClearColor(color: Color, alpha?: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
}

type MapLifeRendererConstructor = new (options: {
  antialias: boolean;
  canvas: HTMLCanvasElement;
  forceWebGL: boolean;
}) => MapLifeRendererSurface;

interface LabRuntime {
  camera: PerspectiveCamera;
  controls: OrbitControls;
  labels: CSS2DRenderer;
  renderer: MapLifeRendererSurface;
  pools: TerrainPropPools | null;
  scene: Scene;
  tiles: number;
}

interface FloraManifest {
  species: { id: string; bytes: number; height: number; triangles: number[] }[];
}

interface CreatureManifest {
  creatures: { id: string; file: string; triangles: number; bytes: number }[];
}

const CREATURE_MANIFEST_PATH = "/models/biome-creatures/manifest.json";
const KNIGHT_PATH = "/models/characters/t1-knight-default/near/skin.glb";
const FLORA_SLOT = 3.4;
const CREATURE_SLOT = 2.6;
const CREATURE_ROW_Z = -4.5;
const NEUTRAL_GROUND = "#8f8c84";
const PROCEDURAL = "procedural (build-time)";
const GALLERY_PAGE = "life-lab";
const SURFACE_GALLERY_LOOK: TerrainPropAppearance = {
  glow: [0, 0, 0],
  moss: 0,
  snow: 0,
  tint: [1, 1, 1],
  windAmplitude: 0.3,
};

export async function mountMapLifeLab(input: MountMapLifeLabInput): Promise<MapLifeLabHandle> {
  const runtime = await createRuntime(input);
  const knight = await loadKnight();
  const floraTiles = await addFloraRow(runtime, input, knight);
  const creatureTiles = await addCreatureRow(runtime.scene, input, knight);
  runtime.tiles = floraTiles + creatureTiles;
  const resize = () => resizeLab(input.canvas, runtime);
  const observer = new ResizeObserver(resize);
  observer.observe(input.canvas);
  resize();
  runtime.renderer.setAnimationLoop(() => drawLab(runtime));
  drawLab(runtime);
  input.onReady(readStats(runtime));
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
    resetCamera: () => frameCamera(runtime),
  };
}

async function createRuntime(input: MountMapLifeLabInput): Promise<LabRuntime> {
  const Renderer = WebGPURenderer as unknown as MapLifeRendererConstructor;
  const renderer = new Renderer({ canvas: input.canvas, antialias: true, forceWebGL: input.forceWebGL });
  configureRendererColorOutput(renderer);
  renderer.setPixelRatio(1);
  renderer.setClearColor(new Color("#20241f"), 1);
  renderer.shadowMap.enabled = true;
  await renderer.init();
  configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);
  const labels = new CSS2DRenderer({ element: input.labels });
  const camera = new PerspectiveCamera(36, 1, 0.05, 400);
  const controls = new OrbitControls(camera, input.labels);
  controls.enableDamping = false;
  const scene = new Scene();
  scene.add(createLights());
  const runtime = { camera, controls, labels, pools: null, renderer, scene, tiles: 0 };
  frameCamera(runtime);
  return runtime;
}

async function addFloraRow(runtime: LabRuntime, input: MountMapLifeLabInput, knight: Object3D) {
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
    runtime.scene.add(createGround(x, 0, FLORA_SLOT * 0.48, floraGroundColour(input.ground, archetype)));
    const anchor = new Object3D();
    anchor.position.set(x, 0, 0);
    runtime.scene.add(anchor);
    labelTile(anchor, row.height, archetype, PROCEDURAL, row.triangles[0], `${Math.round(row.bytes / 1024)} KB`, draws);
    runtime.scene.add(placeKnight(knight, x + 0.9, 0.9));
  });
  return TERRAIN_PROP_ARCHETYPE_IDS.length;
}

function galleryInstance(archetype: TerrainPropArchetypeId, x: number): TerrainPropInstance {
  const layerProp = asLayerProp(archetype);
  return {
    appearance: layerProp ? resolveLayerFloraAppearance(getLayerPropBiomes(layerProp)[0], 1) : SURFACE_GALLERY_LOOK,
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
  const layerProp = asLayerProp(archetype);
  if (ground === "biome" && layerProp) return LAYER_BIOME_LOOKS[getLayerPropBiomes(layerProp)[0]].ground;
  return groundColour(ground, getTerrainPropBiomes(archetype)[0]);
}

function asLayerProp(archetype: TerrainPropArchetypeId): LayerPropId | undefined {
  return LAYER_PROP_IDS.find((id) => id === archetype);
}

async function addCreatureRow(scene: Scene, input: MountMapLifeLabInput, knight: Object3D) {
  const manifest = (await fetchJson(CREATURE_MANIFEST_PATH)) as CreatureManifest;
  await Promise.all(
    manifest.creatures.map(async (creature, index) => {
      const x = index * CREATURE_SLOT;
      scene.add(
        createGround(
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

function createGround(x: number, z: number, radius: number, colour: string): Mesh {
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

function createLights(): Group {
  const lights = new Group();
  lights.add(new AmbientLight(0xdde7e9, 1.4));
  const sun = new DirectionalLight(0xfff2d0, 3);
  sun.position.set(-20, 30, 20);
  sun.target.position.set(20, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 1024);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 12, bottom: -12, near: 1, far: 120 });
  lights.add(sun, sun.target);
  return lights;
}

function frameCamera({ camera, controls }: Pick<LabRuntime, "camera" | "controls">) {
  camera.position.set(2, 7, 9);
  controls.target.set(2, 0.4, -1.5);
  controls.update();
}

function resizeLab(canvas: HTMLCanvasElement, runtime: LabRuntime) {
  const { width, height } = canvas.getBoundingClientRect();
  const size = [Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height))] as const;
  runtime.renderer.setSize(size[0], size[1], false);
  runtime.labels.setSize(size[0], size[1]);
  runtime.camera.aspect = size[0] / size[1];
  runtime.camera.updateProjectionMatrix();
}

function drawLab(runtime: LabRuntime) {
  runtime.controls.update();
  runtime.renderer.render(runtime.scene, runtime.camera);
  runtime.labels.render(runtime.scene, runtime.camera);
}

function readStats(runtime: LabRuntime): MapLifeLabStats {
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
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response.json();
}
