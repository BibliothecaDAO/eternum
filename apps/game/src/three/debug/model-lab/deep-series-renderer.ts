import { ASPECT_HEX } from "@/tokens";
import { DEEP_SITE_FACES } from "@/ui/features/frontier/deep/deep-site-faces";
import { DEEP_WORDS } from "@/ui/design-system/kit/words";
import { aspectName, aspects, deepSites } from "@bibliothecadao/types";
import { Box3, Color, Matrix4, Mesh, Object3D, PerspectiveCamera, Scene, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { initializeProceduralCharacterRendererRuntime } from "../../characters/procedural-character-renderer-runtime";
import { resetGameEnd } from "../../effects/endgame/state";
import { gatePlate, plainPlate } from "../../managers/map-site-manager";
import { PLATE_CLEARANCE } from "../../managers/structure-visible-presentation";
import type { MapPlate } from "../../map-plates/map-plate-model";
import { configureRendererColorOutput } from "../../renderer-color-output";
import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../../scenes/worldmap-camera-view-profile";
import { DeepLandmarkModel, loadDeepLandmark } from "../../structures/deep-landmarks";
import {
  createDeepGateKit,
  createDeepGateVeilGeometry,
  createDeepGateVeilMaterial,
} from "../../structures/deep-site-kit";
import { ModelLabEnvironment } from "./model-lab-environment";
import { readModelLabSettings } from "./model-lab-settings";

export interface DeepSeriesSettings {
  set: "gates" | "sites";
  distance: number;
  yaw: number;
  overlay: boolean;
  focus: number | null;
}

export interface DeepSeriesPlateOverlay {
  readonly key: string;
  readonly plate: MapPlate;
  readonly left: number;
  readonly top: number;
  readonly visible: boolean;
}

interface PlateAnchor {
  readonly key: string;
  readonly plate: MapPlate;
  readonly world: Vector3;
}

type DeepSeriesEntry =
  | {
      readonly kind: "mesh";
      readonly key: string;
      readonly label: string;
      readonly root: Object3D;
      readonly plate: MapPlate;
    }
  | {
      readonly kind: "landmark";
      readonly key: string;
      readonly label: string;
      readonly model: DeepLandmarkModel;
      readonly plate: MapPlate;
    };

export async function mountDeepSeries(
  container: HTMLElement,
  settings: DeepSeriesSettings,
  signal: AbortSignal,
  onPlates?: (plates: DeepSeriesPlateOverlay[]) => void,
) {
  resetGameEnd();
  const initialized = await initializeProceduralCharacterRendererRuntime({ pixelRatioCap: 1.5, preloadPhysics: false });
  const renderer = initialized.rendererRuntime.renderer;
  configureRendererColorOutput(renderer);
  renderer.shadowMap.enabled = true;
  const scene = new Scene();
  scene.background = new Color(0x1f2530);
  const environment = new ModelLabEnvironment(scene);
  const camera = new PerspectiveCamera(resolveWorldmapCameraFieldOfViewDegrees(), 1, 0.1, 150);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 2.5;
  controls.maxDistance = 55;
  const placedMeshes: Object3D[] = [];
  const placedLandmarks: DeepLandmarkModel[] = [];
  const plateAnchors: PlateAnchor[] = [];
  const projected = new Vector3();
  let lastOverlaySignature = "";
  let frame = 0;
  let last = performance.now();
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  const dispose = () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    controls.dispose();
    onPlates?.([]);
    for (const root of placedMeshes) disposeTree(root);
    placedMeshes.length = 0;
    for (const model of placedLandmarks) model.dispose();
    placedLandmarks.length = 0;
    environment.dispose();
    initialized.unitRuntime.dispose();
    initialized.rendererRuntime.backend.dispose();
    renderer.domElement.remove();
  };
  try {
    signal.throwIfAborted();
    container.append(renderer.domElement);
    observer.observe(container);
    resize();
    await environment.update(readModelLabSettings(new URLSearchParams("family=knight&biome=bare")));
    signal.throwIfAborted();

    const entries = await buildDeepSeriesEntries(settings.set);
    signal.throwIfAborted();
    const labels: string[] = [];
    const yawRadians = (settings.yaw * Math.PI) / 180;
    const slotPositions: number[] = [];
    let maxHeight = 0;

    for (const [slot, entry] of entries.entries()) {
      const x = (slot - (entries.length - 1) / 2) * Math.sqrt(3) * 1.8;
      slotPositions.push(x);
      const y = environment.terrain.sampleHeight(x, 0);
      let modelHeight: number;
      if (entry.kind === "landmark") {
        const matrix = new Matrix4().makeRotationY(yawRadians).setPosition(x, y, 0);
        entry.model.setMatrixAt(0, matrix);
        entry.model.setHolderColorAt(0, null);
        entry.model.setCount(1);
        entry.model.needsUpdate();
        scene.add(entry.model.group);
        placedLandmarks.push(entry.model);
        modelHeight = entry.model.landmarkHeight;
      } else {
        entry.root.position.set(x, y, 0);
        entry.root.rotation.y = yawRadians;
        modelHeight = new Box3().setFromObject(entry.root).max.y - y;
        scene.add(entry.root);
        placedMeshes.push(entry.root);
      }
      maxHeight = Math.max(maxHeight, modelHeight);
      labels.push(entry.label);

      if (settings.overlay) {
        plateAnchors.push({
          key: entry.key,
          plate: entry.plate,
          world: new Vector3(x, y + modelHeight + PLATE_CLEARANCE, 0),
        });
      }
    }

    const targetX =
      settings.focus !== null && settings.focus >= 0 && settings.focus < slotPositions.length
        ? slotPositions[settings.focus]!
        : 0;
    controls.target.set(targetX, environment.terrain.sampleHeight(targetX, 0) + maxHeight * 0.48, 0);
    const pitch = resolveWorldmapCameraPitchRadians(settings.distance);
    camera.position
      .copy(controls.target)
      .add(new Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(settings.distance));
    controls.update();

    const publishPlates = () => {
      if (!onPlates || !settings.overlay) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      const next: DeepSeriesPlateOverlay[] = plateAnchors.map(({ key, plate, world }) => {
        projected.copy(world).project(camera);
        return {
          key,
          plate,
          left: Math.round(((projected.x + 1) / 2) * width),
          top: Math.round(((1 - projected.y) / 2) * height),
          visible: Math.abs(projected.z) <= 1,
        };
      });
      const signature = next.map((item) => `${item.key}:${item.left},${item.top},${item.visible}`).join("|");
      if (signature !== lastOverlaySignature) {
        lastOverlaySignature = signature;
        onPlates(next);
      }
    };

    const render = () => {
      if (signal.aborted) return;
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      environment.frame(delta, controls.target, "day");
      controls.update();
      renderer.render(scene, camera);
      publishPlates();
      frame = requestAnimationFrame(render);
    };
    render();
    return { dispose, labels };
  } catch (error) {
    dispose();
    throw error;
  }
}

async function buildDeepSeriesEntries(set: DeepSeriesSettings["set"]): Promise<DeepSeriesEntry[]> {
  if (set === "gates") {
    return aspects.map(({ id }) => {
      const root = createDeepGateKit(id).scene;
      const veil = new Mesh(createDeepGateVeilGeometry(), createDeepGateVeilMaterial(ASPECT_HEX[id]));
      veil.renderOrder = 2;
      root.add(veil);
      return {
        kind: "mesh",
        key: `gate:${id}`,
        label: `${aspectName(id)} · ${DEEP_WORDS.gate}`,
        root,
        plate: gatePlate(id, false),
      };
    });
  }
  return Promise.all(
    deepSites.map(async (site) => {
      const landmark = await loadDeepLandmark(site.key, 1);
      return {
        kind: "landmark",
        key: `site:${site.key}`,
        label: site.name,
        model: new DeepLandmarkModel(landmark, 1, site.name, 1),
        plate: plainPlate(site, DEEP_SITE_FACES[site.key].icon),
      };
    }),
  );
}

function disposeTree(root: Object3D): void {
  root.traverse((node) => {
    if (node instanceof Mesh) {
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) material?.dispose();
    }
  });
}
