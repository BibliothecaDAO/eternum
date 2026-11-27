import { ASPECT_HEX } from "@/tokens";
import { aspectName, aspects, deepSites } from "@bibliothecadao/types";
import { DEEP_WORDS } from "@/ui/design-system/kit/words";
import { Box3, Color, Mesh, Object3D, PerspectiveCamera, Scene, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { initializeProceduralCharacterRendererRuntime } from "../../characters/procedural-character-renderer-runtime";
import { resetGameEnd } from "../../effects/endgame/state";
import { configureRendererColorOutput } from "../../renderer-color-output";
import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../../scenes/worldmap-camera-view-profile";
import { loadDeepLandmark } from "../../structures/deep-landmarks";
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
}

export async function mountDeepSeries(container: HTMLElement, settings: DeepSeriesSettings, signal: AbortSignal) {
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
  const placed: Object3D[] = [];
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
    for (const root of placed) disposeTree(root);
    placed.length = 0;
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
    let maxHeight = 0;

    for (const [slot, entry] of entries.entries()) {
      const x = (slot - (entries.length - 1) / 2) * Math.sqrt(3) * 1.8;
      const y = environment.terrain.sampleHeight(x, 0);
      entry.root.position.set(x, y, 0);
      entry.root.rotation.y = yawRadians;
      maxHeight = Math.max(maxHeight, new Box3().setFromObject(entry.root).max.y - y);
      scene.add(entry.root);
      placed.push(entry.root);
      labels.push(entry.label);
    }

    controls.target.set(0, environment.terrain.sampleHeight(0, 0) + maxHeight * 0.48, 0);
    const pitch = resolveWorldmapCameraPitchRadians(settings.distance);
    camera.position
      .copy(controls.target)
      .add(new Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(settings.distance));
    controls.update();

    const render = () => {
      if (signal.aborted) return;
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      environment.frame(delta, controls.target, "day");
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();
    return { dispose, labels };
  } catch (error) {
    dispose();
    throw error;
  }
}

async function buildDeepSeriesEntries(
  set: DeepSeriesSettings["set"],
): Promise<Array<{ label: string; root: Object3D }>> {
  if (set === "gates") {
    return aspects.map(({ id }) => {
      const root = createDeepGateKit(id).scene;
      const veil = new Mesh(createDeepGateVeilGeometry(), createDeepGateVeilMaterial(ASPECT_HEX[id]));
      veil.renderOrder = 2;
      root.add(veil);
      return {
        label: `${aspectName(id)} · ${DEEP_WORDS.gate}`,
        root,
      };
    });
  }
  return Promise.all(
    deepSites.map(async (site) => ({
      label: site.name,
      root: (await loadDeepLandmark(site.key, 1)).scene,
    })),
  );
}

function disposeTree(root: Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) material?.dispose();
  });
}
