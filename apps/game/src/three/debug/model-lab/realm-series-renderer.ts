import { Box3, Color, Matrix4, PerspectiveCamera, Scene, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { initializeProceduralCharacterRendererRuntime } from "../../characters/procedural-character-renderer-runtime";
import { SettlementModel } from "../../structures/settlement-model";
import { BASE_REALM_CANDIDATES, REALM_ASSETS, realmModelIndex } from "../../structures/realm-design";
import { gltfLoader } from "../../utils/utils";
import { configureRendererColorOutput } from "../../renderer-color-output";
import { ModelLabEnvironment } from "./model-lab-environment";
import { readModelLabSettings } from "./model-lab-settings";
import { resetGameEnd } from "../../effects/endgame/state";

import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../../scenes/worldmap-camera-view-profile";

export interface RealmSeriesSettings {
  level: number;
  wonder: boolean;
  seed: string;
  order: number;
  owned: boolean;
  distance: number;
  lineup: boolean;
  base: boolean;
  grow: boolean;
  reference?: string;
  comparison: "before" | "after" | "pair";
}

/** Uses the game's instanced models and heraldry, at model scale one on the client's terrain. */
export async function mountRealmSeries(container: HTMLElement, settings: RealmSeriesSettings, signal: AbortSignal) {
  resetGameEnd();
  const initialized = await initializeProceduralCharacterRendererRuntime({ pixelRatioCap: 1.5, preloadPhysics: false });
  const renderer = initialized.rendererRuntime.renderer;
  configureRendererColorOutput(renderer);
  renderer.shadowMap.enabled = true;
  const scene = new Scene();
  scene.background = new Color(0x819997);
  const environment = new ModelLabEnvironment(scene);
  const camera = new PerspectiveCamera(resolveWorldmapCameraFieldOfViewDegrees(), 1, 0.1, 150);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 3;
  controls.maxDistance = 65;
  const models: SettlementModel[] = [];
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
    models.forEach((model) => model.dispose());
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
    await environment.update(readModelLabSettings(new URLSearchParams("family=knight&biome=grassland")));
    signal.throwIfAborted();
    const series = realmSeries(settings);
    const labels: string[] = [];
    let height = 0;
    for (const [slot, { asset, before }] of series.entries()) {
      const gltf = await gltfLoader.loadAsync(
        before ? `${settings.reference!.replace(/\/$/, "")}/${asset.id}.glb` : asset.path,
      );
      const modelHeight = new Box3().setFromObject(gltf.scene).max.y;
      const scale = settings.grow && asset.grownHeight ? asset.grownHeight / modelHeight : 1;
      height = Math.max(height, modelHeight * scale);
      const model = new SettlementModel(gltf, 1, "realm", asset.wonder);
      models.push(model);
      await model.prepare();
      signal.throwIfAborted();
      const x = (slot - (series.length - 1) / 2) * Math.sqrt(3) * 2;
      model.setMatrixAt(
        0,
        new Matrix4()
          .makeTranslation(x, environment.terrain.sampleHeight(x, 0), 0)
          .multiply(new Matrix4().makeScale(scale, scale, scale)),
      );
      model.setCount(1);
      model.setOrderAt(0, settings.order);
      model.setRelationshipAt(0, settings.owned ? "owned" : "enemy");
      model.setWonderEntityAt(0, settings.seed);
      scene.add(model.group);
      labels.push(before ? "Before" : series.some((each) => each.before) ? `After · ${asset.label}` : asset.label);
    }
    controls.target.set(0, environment.terrain.sampleHeight(0, 0) + (settings.distance <= 10 ? height / 2 : 0.5), 0);
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
      models.forEach((model) => model.updateAnimations(delta));
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

type SeriesSlot = { asset: (typeof REALM_ASSETS)[number]; before: boolean };

function realmSeries(settings: RealmSeriesSettings): SeriesSlot[] {
  const shipped = (level: number, wonder = settings.wonder) =>
    REALM_ASSETS[realmModelIndex(level, wonder, settings.seed)];
  if (settings.base)
    return [0, 1, 2, 3]
      .flatMap((level) => [shipped(level, false), ...BASE_REALM_CANDIDATES.filter((asset) => asset.level === level)])
      .map((asset) => ({ asset, before: false }));
  if (settings.reference && settings.comparison !== "after") {
    const asset = shipped(settings.level);
    return settings.comparison === "pair"
      ? [
          { asset, before: true },
          { asset, before: false },
        ]
      : [{ asset, before: true }];
  }
  return (settings.lineup ? [0, 1, 2, 3] : [settings.level]).map((level) => ({ asset: shipped(level), before: false }));
}
