import "./static-model-lineup.css";
import { Box3, Color, Matrix4, PerspectiveCamera, Scene, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { initializeProceduralCharacterRendererRuntime } from "../../characters/procedural-character-renderer-runtime";
import { CAMERA_CONFIG, LOCAL_CAMERA_ZOOM } from "../../constants/rendering";
import { resetGameEnd } from "../../effects/endgame/state";
import InstancedModel from "../../managers/instanced-model";
import { configureRendererColorOutput } from "../../renderer-color-output";
import { gltfLoader } from "../../utils/utils";
import { ModelLabEnvironment } from "./model-lab-environment";
import { readModelLabSettings } from "./model-lab-settings";

export interface LineupAsset {
  label: string;
  position?: { x: number; z: number };
  parts: readonly { path: string; scale?: number; z?: number }[];
}
export interface LineupSettings {
  distance: number;
  focus: "lineup" | number;
  yaw: number;
  lighting: "day" | "sunset";
}

/** The same instancing, materials, terrain and lighting as the game, at scale one. */
export async function mountStaticLineup(
  container: HTMLElement,
  settings: LineupSettings,
  signal: AbortSignal,
  lineup: readonly LineupAsset[],
) {
  resetGameEnd();
  delete container.dataset.lineupRendered;
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
  const heights: number[] = [];
  const parts: { scale: number; z: number; slot: number }[] = [];
  container.classList.add("model-lineup");
  const labels = lineup.map((asset) => {
    const label = document.createElement("div");
    label.className = "model-lineup-label";
    label.textContent = asset.label.replace(" · ", "\n");
    container.append(label);
    return label;
  });
  const projected = new Vector3();
  const placeLabels = () => {
    labels.forEach((label, index) => {
      projected.copy(positions[index]).project(camera);
      label.hidden = (current.focus !== "lineup" && current.focus !== index) || Math.abs(projected.z) > 1;
      label.style.left = `${((projected.x + 1) / 2) * container.clientWidth}px`;
      label.style.top = `${((1 - projected.y) / 2) * container.clientHeight + 18}px`;
    });
  };
  const drawnAssets = new Set<string>();
  const drawnParts = new Set<number>();
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
    labels.forEach((label) => label.remove());
    controls.dispose();
    models.forEach((model) => model.dispose());
    environment.dispose();
    initialized.unitRuntime.dispose();
    initialized.rendererRuntime.backend.dispose();
    renderer.domElement.remove();
  };
  const update = (next: LineupSettings) => {
    current = next;
    capturePending = true;
    models.forEach((model, index) => {
      const part = parts[index];
      const matrix = new Matrix4().makeRotationY((next.yaw * Math.PI) / 180);
      matrix.setPosition(positions[part.slot]);
      matrix.multiply(new Matrix4().makeTranslation(0, 0, part.z));
      matrix.scale(new Vector3(part.scale, part.scale, part.scale));
      model.setMatrixAt(0, matrix);
    });
    const x = next.focus === "lineup" ? 0 : positions[next.focus].x;
    const z = next.focus === "lineup" ? 0 : positions[next.focus].z;
    const height = next.focus === "lineup" ? 0.8 : heights[next.focus];
    controls.target.set(x, environment.terrain.sampleSurface(x, z).height + height / 2, z);
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
    for (const [slot, asset] of lineup.entries()) {
      const { x, z } = asset.position ?? { x: (slot - (lineup.length - 1) / 2) * Math.sqrt(3) * 1.5, z: 0 };
      positions.push(new Vector3(x, environment.terrain.sampleSurface(x, z).height, z));
      heights.push(0);
      for (const part of asset.parts) {
        const gltf = await gltfLoader.loadAsync(part.path);
        signal.throwIfAborted();
        heights[slot] = Math.max(heights[slot], new Box3().setFromObject(gltf.scene).max.y * (part.scale ?? 1));
        const model = new InstancedModel(gltf, 1, false, asset.label);
        models.push(model);
        parts.push({ scale: part.scale ?? 1, z: part.z ?? 0, slot });
        const instance = models.length - 1;
        model.instancedMeshes.forEach((mesh) => {
          const afterRender = mesh.onAfterRender;
          mesh.onAfterRender = (...args) => {
            afterRender.apply(mesh, args);
            drawnAssets.add(part.path);
            drawnParts.add(instance);
          };
        });
        model.setCount(1);
        scene.add(model.group);
      }
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
      drawnParts.clear();
      renderer.render(scene, camera);
      placeLabels();
      const selectionDrawn =
        current.focus === "lineup"
          ? drawnParts.size === models.length
          : lineup[current.focus].parts.every((part) => drawnAssets.has(part.path));
      if (capturePending && selectionDrawn) {
        container.dataset.lineupRendered = JSON.stringify({
          ...current,
          models: models.length,
          drawnAssets: [...drawnAssets],
          drawnParts: [...drawnParts],
          cameraDistance: camera.position.distanceTo(controls.target),
          calls: renderer.info.render.calls,
        });
        capturePending = false;
      }
      frame = requestAnimationFrame(render);
    };
    render();
    return { dispose, update, assets: lineup.flatMap((asset) => asset.parts.map((part) => part.path)) };
  } catch (error) {
    dispose();
    throw error;
  }
}
