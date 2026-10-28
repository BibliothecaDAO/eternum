import {
  BatchedMesh,
  Color,
  Matrix4,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  type Material,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getCanonicalRealmMetadata } from "@bibliothecadao/eternum";
import { initializeProceduralCharacterRendererRuntime } from "../../../characters/procedural-character-renderer-runtime";
import { SettlementModel } from "../../../structures/settlement-model";
import { REALM_ASSETS } from "../../../structures/realm-design";
import { gltfLoader } from "../../../utils/utils";
import { MaterialPool } from "../../../utils/material-pool";
import { configureRendererColorOutput } from "../../../renderer-color-output";
import { resetGameEnd } from "../../../effects/endgame/state";
import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../../../scenes/worldmap-camera-view-profile";
import { ModelLabEnvironment } from "../model-lab-environment";
import { readModelLabSettings } from "../model-lab-settings";
import { cutRealmKit, type RealmKitModule } from "./realm-kit";
import { resolveRealmKitDesign, type RealmKitDesign, type RealmKitLevel, type Rgb } from "./realm-kit-design";

/** Twelve real Realm NFTs, spread over the collection. */
const PROCEDURAL_REALM_IDS = [1, 7, 42, 99, 256, 777, 1024, 2048, 3333, 4096, 5555, 7999] as const;
const COLUMNS = 4;
const SPACING = 2.6;

export interface ProceduralRealmsSettings {
  level: RealmKitLevel;
  /** Camera distance, as the map's zoom names it; 0 frames the whole grid. */
  distance: number;
  /** The slot the camera looks at when it does not frame the grid. */
  focus: number;
}

export interface ProceduralRealmsStats {
  slots: Array<{ label: string; x: number; y: number }>;
  kitDraws: number;
  kitMaterials: number;
  kitModules: number;
  realmTriangles: { min: number; max: number };
  sceneDraws: number;
}

interface Slot {
  label: string;
  design?: RealmKitDesign;
  position: Vector3;
}

/** Shipped model, the kit's fixed design and twelve player Realms, on the client's terrain and lighting. */
export async function mountProceduralRealms(
  container: HTMLElement,
  settings: ProceduralRealmsSettings,
  signal: AbortSignal,
  onStats: (stats: ProceduralRealmsStats) => void,
) {
  resetGameEnd();
  const initialized = await initializeProceduralCharacterRendererRuntime({ pixelRatioCap: 1.5, preloadPhysics: false });
  const renderer = initialized.rendererRuntime.renderer;
  configureRendererColorOutput(renderer);
  renderer.shadowMap.enabled = true;
  const scene = new Scene();
  scene.background = new Color(0x819997);
  const environment = new ModelLabEnvironment(scene);
  const camera = new PerspectiveCamera(resolveWorldmapCameraFieldOfViewDegrees(), 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  const disposables: Array<() => void> = [];
  let frame = 0;
  let last = performance.now();
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  const dispose = () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    controls.dispose();
    disposables.forEach((release) => release());
    environment.dispose();
    initialized.unitRuntime.dispose();
    initialized.rendererRuntime.backend.dispose();
    renderer.domElement.remove();
  };
  try {
    container.append(renderer.domElement);
    observer.observe(container);
    resize();
    await environment.update(readModelLabSettings(new URLSearchParams("family=knight&biome=grassland")));
    signal.throwIfAborted();
    const slots = await resolveSlots(settings.level, (x, z) => environment.terrain.sampleSurface(x, z).height);
    signal.throwIfAborted();
    const asset = REALM_ASSETS[settings.level];
    const shipped = new SettlementModel(await gltfLoader.loadAsync(asset.path), 1, "realm", false);
    disposables.push(() => shipped.dispose());
    await shipped.prepare();
    shipped.setMatrixAt(0, new Matrix4().makeTranslation(slots[0].position));
    shipped.setCount(1);
    shipped.setRelationshipAt(0, "owned");
    scene.add(shipped.group);
    const kit = cutRealmKit(await gltfLoader.loadAsync(asset.path), settings.level);
    signal.throwIfAborted();
    const batches = drawKit(kit, slots.slice(1));
    batches.forEach((batch) => scene.add(batch));
    disposables.push(() => batches.forEach((batch) => batch.dispose()));
    frameCamera(camera, controls, slots, settings);
    const render = () => {
      if (signal.aborted) return;
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      shipped.updateAnimations(delta);
      environment.frame(delta, controls.target, "day");
      controls.update();
      renderer.render(scene, camera);
      onStats(measure(slots, kit, batches, camera, container, renderer.info.render.calls));
      frame = requestAnimationFrame(render);
    };
    render();
    return { dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

async function resolveSlots(level: RealmKitLevel, groundAt: (x: number, z: number) => number): Promise<Slot[]> {
  const players = await Promise.all(
    PROCEDURAL_REALM_IDS.map(async (realmId) => {
      const { name, resources } = await getCanonicalRealmMetadata(realmId);
      return {
        label: `#${realmId} ${name}`,
        design: resolveRealmKitDesign(level, { realmId, resourceCount: resources.length }),
      };
    }),
  );
  const entries = [
    { label: "Shipped model" },
    { label: "Fixed design (synthetic)", design: resolveRealmKitDesign(level) },
    ...players,
  ];
  const rows = Math.ceil(entries.length / COLUMNS);
  return entries.map((entry, index) => {
    const x = ((index % COLUMNS) - (COLUMNS - 1) / 2) * SPACING;
    const z = (Math.floor(index / COLUMNS) - (rows - 1) / 2) * SPACING;
    return { ...entry, position: new Vector3(x, groundAt(x, z), z) };
  });
}

/** One batch per shipped material: every module and every Realm in it share that material's one draw. */
function drawKit(kit: Map<string, RealmKitModule>, slots: Slot[]): BatchedMesh[] {
  const materials = new Map<Material, Array<{ module: string; part: number }>>();
  for (const [module, { parts }] of kit) {
    parts.forEach(({ material }, part) =>
      materials.set(material, [...(materials.get(material) ?? []), { module, part }]),
    );
  }
  const matrix = new Matrix4();
  const tint = new Color();
  return [...materials].map(([material, entries]) => {
    const geometries = entries.map(({ module, part }) => kit.get(module)!.parts[part].geometry);
    const vertices = geometries.reduce((sum, geometry) => sum + geometry.getAttribute("position").count, 0);
    const indices = geometries.reduce((sum, geometry) => sum + geometry.index!.count, 0);
    const instances = slots.reduce((sum, slot) => sum + slot.design!.placements.length, 0);
    const pooled = MaterialPool.getInstance().getStandardMaterial(material as MeshStandardMaterial);
    const batch = new BatchedMesh(instances, vertices, indices, pooled);
    batch.name = `Realm kit: ${material.name}`;
    batch.castShadow = batch.receiveShadow = true;
    batch.perObjectFrustumCulled = false;
    const ids = new Map(entries.map(({ module }, index) => [module, batch.addGeometry(geometries[index])]));
    for (const slot of slots) {
      for (const placement of slot.design!.placements) {
        const geometry = ids.get(placement.module);
        if (geometry === undefined) continue;
        const instance = batch.addInstance(geometry);
        batch.setMatrixAt(instance, composePlacement(matrix, slot.position, kit, placement));
        batch.setColorAt(instance, tint.setRGB(...tintOf(material, slot.design!)));
      }
    }
    return batch;
  });
}

const translation = new Matrix4();
const local = new Matrix4();
const unpivot = new Matrix4();
const yawRotation = new Quaternion();
const up = new Vector3(0, 1, 0);

/** Move the module's pivot onto the pivot of the place it takes, then stretch it up from its base. */
function composePlacement(
  out: Matrix4,
  origin: Vector3,
  kit: Map<string, RealmKitModule>,
  placement: RealmKitDesign["placements"][number],
): Matrix4 {
  const from = kit.get(placement.module)!.pivot;
  const to = kit.get(placement.at)!.pivot;
  unpivot.makeTranslation(-from.x, -from.y, -from.z);
  local.compose(
    new Vector3(origin.x + to.x, origin.y + to.y, origin.z + to.z),
    yawRotation.setFromAxisAngle(up, placement.yaw),
    new Vector3(1, placement.heightScale, 1),
  );
  return out.multiplyMatrices(local, unpivot);
}

/** Stone and roof materials take the Realm's palette; timber, gold, glass and cloth keep the painted colour. */
function tintOf(material: Material, design: RealmKitDesign): Rgb {
  if (/roof|slate/i.test(material.name)) return design.roof;
  if (/stone|limestone|mortar|painted village/i.test(material.name)) return design.stone;
  return [1, 1, 1];
}

function frameCamera(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  slots: Slot[],
  settings: ProceduralRealmsSettings,
) {
  const grid = settings.distance === 0;
  const focus = slots[Math.min(slots.length - 1, Math.max(0, settings.focus))].position;
  const distance = grid ? 15 : settings.distance;
  controls.target.copy(grid ? new Vector3(0, 0.6, 0.9) : focus.clone().add(new Vector3(0, 0.6, SPACING / 2)));
  const pitch = resolveWorldmapCameraPitchRadians(distance);
  camera.position.copy(controls.target).add(new Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(distance));
  controls.update();
}

const projected = new Vector3();

function measure(
  slots: Slot[],
  kit: Map<string, RealmKitModule>,
  batches: BatchedMesh[],
  camera: PerspectiveCamera,
  container: HTMLElement,
  sceneDraws: number,
): ProceduralRealmsStats {
  const { width, height } = container.getBoundingClientRect();
  const triangles = slots
    .slice(1)
    .map((slot) => slot.design!.placements.reduce((sum, { module }) => sum + kit.get(module)!.triangles, 0));
  return {
    slots: slots.map(({ label, position }) => {
      projected
        .copy(position)
        .add(new Vector3(0, -0.15, 1.05))
        .project(camera);
      return { label, x: ((projected.x + 1) / 2) * width, y: ((1 - projected.y) / 2) * height };
    }),
    kitDraws: batches.length,
    kitMaterials: new Set(batches.map((batch) => batch.material)).size,
    kitModules: kit.size,
    realmTriangles: { min: Math.min(...triangles), max: Math.max(...triangles) },
    sceneDraws,
  };
}
