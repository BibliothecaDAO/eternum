import { BuildingType } from "@bibliothecadao/types";
import { buildingModelPaths, BUILDINGS_GROUPS } from "../../constants/scene-constants";
import { Color, Matrix4, PerspectiveCamera, Scene, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { initializeProceduralCharacterRendererRuntime } from "../../characters/procedural-character-renderer-runtime";
import { CAMERA_CONFIG, LOCAL_CAMERA_ZOOM } from "../../constants/rendering";
import { resetGameEnd } from "../../effects/endgame/state";
import InstancedModel from "../../managers/instanced-model";
import { configureRendererColorOutput } from "../../renderer-color-output";
import { gltfLoader } from "../../utils/utils";
import { ModelLabEnvironment } from "./model-lab-environment";
import { readModelLabSettings } from "./model-lab-settings";

export const WORKSHOP_LINEUP = [
  { label: "Farm · shipped", path: "/models/new-buildings-opt/farm.glb", name: "Farm" },
  {
    label: "Workshop · Craft Yard",
    path: buildingModelPaths(false)[BUILDINGS_GROUPS.BUILDINGS][BuildingType.ResourceLabor],
    name: "Workshop",
  },
  { label: "Workers Hut · shipped", path: "/models/new-buildings-opt/workers_hut.glb", name: "WorkersHut" },
] as const;

export interface WorkshopLabSettings {
  distance: number;
  focus: "lineup" | "workshop";
  yaw: number;
  lighting: "day" | "sunset";
}

/** The same instancing, materials, terrain and lighting as the game, at scale one. */
export async function mountWorkshopLab(container: HTMLElement, settings: WorkshopLabSettings, signal: AbortSignal) {
  resetGameEnd();
  const initialized = await initializeProceduralCharacterRendererRuntime({ pixelRatioCap: 1.5, preloadPhysics: false });
  const renderer = initialized.rendererRuntime.renderer;
  configureRendererColorOutput(renderer);
  renderer.shadowMap.enabled = true;
  const scene = new Scene();
  scene.background = new Color(0x819997);
  const environment = new ModelLabEnvironment(scene);
  const camera = new PerspectiveCamera(CAMERA_CONFIG.fov, 1, 0.1, 150);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 3;
  controls.maxDistance = 35;
  const models: InstancedModel[] = [];
  const positions: Vector3[] = [];
  const drawnAssets = new Set<string>();
  let current = settings;
  let frame = 0;
  let last = performance.now();
  let disposed = false;
  let capturePending = true;
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    controls.dispose();
    models.forEach((model) => model.dispose());
    environment.dispose();
    initialized.unitRuntime.dispose();
    initialized.rendererRuntime.backend.dispose();
    renderer.domElement.remove();
  };
  const update = (next: WorkshopLabSettings) => {
    current = next;
    capturePending = true;
    models.forEach((model, index) => {
      const matrix = new Matrix4().makeRotationY((next.yaw * Math.PI) / 180);
      matrix.setPosition(positions[index]);
      model.setMatrixAt(0, matrix);
    });
    const x = next.focus === "workshop" ? positions[1].x : 0;
    controls.target.set(x, environment.terrain.sampleSurface(x, 0).height + 0.4, 0);
    const pitch = LOCAL_CAMERA_ZOOM.pitchRadians;
    camera.position
      .copy(controls.target)
      .add(new Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(next.distance));
    controls.update();
  };
  try {
    signal.throwIfAborted();
    container.append(renderer.domElement);
    observer.observe(container);
    resize();
    await environment.update(readModelLabSettings(new URLSearchParams("family=knight&biome=grassland")));
    signal.throwIfAborted();
    for (const [index, asset] of WORKSHOP_LINEUP.entries()) {
      const gltf = await gltfLoader.loadAsync(asset.path);
      const model = new InstancedModel(gltf, 1, false, asset.name);
      models.push(model);
      model.instancedMeshes.forEach((mesh) => {
        const afterRender = mesh.onAfterRender;
        mesh.onAfterRender = (...args) => {
          afterRender.apply(mesh, args);
          drawnAssets.add(asset.path);
        };
      });
      signal.throwIfAborted();
      const x = (index - 1) * Math.sqrt(3) * 1.5;
      positions.push(new Vector3(x, environment.terrain.sampleSurface(x, 0).height, 0));
      model.setCount(1);
      scene.add(model.group);
    }
    update(settings);
    const render = () => {
      if (signal.aborted || disposed) return;
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      models.forEach((model) => model.updateAnimations(delta));
      environment.frame(delta, controls.target, current.lighting);
      controls.update();
      drawnAssets.clear();
      renderer.render(scene, camera);
      const selectionDrawn =
        current.focus === "lineup"
          ? drawnAssets.size === WORKSHOP_LINEUP.length
          : drawnAssets.has(WORKSHOP_LINEUP[1].path);
      if (capturePending && selectionDrawn) {
        container.dataset.workshopRendered = JSON.stringify({
          ...current,
          models: models.length,
          drawnAssets: [...drawnAssets],
          cameraDistance: camera.position.distanceTo(controls.target),
          calls: renderer.info.render.calls,
        });
        capturePending = false;
      }
      frame = requestAnimationFrame(render);
    };
    render();
    return { dispose, update, assets: WORKSHOP_LINEUP.map((asset) => asset.path) };
  } catch (error) {
    dispose();
    throw error;
  }
}
