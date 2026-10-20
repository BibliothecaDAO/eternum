import "./static-model-lineup.css";
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
import { FrontierModel, frontierModelKind } from "../../structures/frontier-model";
import { RewardTileModel } from "../../rewards/reward-tile-model";

export interface LineupAsset {
  label: string;
  position?: { x: number; z: number };
  parts: readonly { path: string; scale?: number; z?: number; y?: number }[];
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
  const models: Array<InstancedModel | RewardTileModel> = [];
  const batches = new Map<string, { model: InstancedModel | RewardTileModel; count: number; parts: number[] }>();
  const positions: Vector3[] = [];
  const heights: number[] = [];
  const parts: {
    scale: number;
    z: number;
    y: number;
    slot: number;
    model: InstancedModel | RewardTileModel;
    index: number;
  }[] = [];
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
  let sampling:
    | {
        remaining: number;
        gl: WebGL2RenderingContext;
        frames: number[];
        resolve: (value: { frames: number[]; calls: number; triangles: number; gpu: string }) => void;
        reject: (reason: Error) => void;
      }
    | undefined;
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
    sampling?.reject(new Error("Lab closed during frame measurement"));
    sampling = undefined;
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
    parts.forEach((part) => {
      const matrix = new Matrix4().makeRotationY((next.yaw * Math.PI) / 180);
      matrix.setPosition(positions[part.slot]);
      matrix.multiply(new Matrix4().makeTranslation(0, part.y, part.z));
      matrix.scale(new Vector3(part.scale, part.scale, part.scale));
      part.model.setMatrixAt(part.index, matrix);
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
        let batch = batches.get(part.path);
        if (!batch) {
          const gltf = await gltfLoader.loadAsync(part.path);
          signal.throwIfAborted();
          const capacity = lineup.flatMap((entry) => entry.parts).filter((entry) => entry.path === part.path).length;
          const kind = frontierModelKind(part.path);
          const model = kind
            ? new FrontierModel(gltf, capacity, kind)
            : part.path === "/models/reward-tiles/rift.glb"
              ? new RewardTileModel(gltf, capacity)
              : new InstancedModel(gltf, capacity, false, asset.label);
          batch = { model, count: 0, parts: [] };
          batches.set(part.path, batch);
          models.push(model);
          scene.add(model.group);
          const active = batch;
          model.instancedMeshes.forEach((mesh) => {
            const afterRender = mesh.onAfterRender;
            mesh.onAfterRender = (...args) => {
              afterRender.apply(mesh, args);
              drawnAssets.add(part.path);
              active.parts.forEach((index) => drawnParts.add(index));
            };
          });
        }
        heights[slot] = Math.max(heights[slot], batch.model.height * (part.scale ?? 1) + (part.y ?? 0));
        batch.parts.push(parts.length);
        parts.push({
          scale: part.scale ?? 1,
          z: part.z ?? 0,
          y: part.y ?? 0,
          slot,
          model: batch.model,
          index: batch.count++,
        });
        batch.model.setCount(batch.count);
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
      if (sampling) {
        sampling.gl.finish();
        sampling.frames.push(performance.now() - now);
        if (--sampling.remaining === 0) {
          const extension = sampling.gl.getExtension("WEBGL_debug_renderer_info");
          sampling.resolve({
            frames: sampling.frames,
            calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            gpu: String(sampling.gl.getParameter(extension?.UNMASKED_RENDERER_WEBGL ?? sampling.gl.RENDERER)),
          });
          sampling = undefined;
        }
      }
      placeLabels();
      const selectionDrawn =
        current.focus === "lineup"
          ? drawnParts.size === parts.length
          : lineup[current.focus].parts.every((part) => drawnAssets.has(part.path));
      if (capturePending && selectionDrawn) {
        container.dataset.lineupRendered = JSON.stringify({
          ...current,
          models: parts.length,
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
    return {
      dispose,
      update,
      setMistVisible(visible: boolean) {
        models.forEach((model) => {
          if (model instanceof FrontierModel) model.setMistVisible(visible);
        });
      },
      measureFrames(count: number) {
        const backend = (renderer as unknown as { backend: { getContext?: () => WebGL2RenderingContext } }).backend;
        const gl = backend.getContext?.();
        if (!gl?.finish) return Promise.reject(new Error("Synchronized frame measurement requires the WebGL renderer"));
        if (sampling) return Promise.reject(new Error("A frame measurement is already running"));
        return new Promise<{ frames: number[]; calls: number; triangles: number; gpu: string }>((resolve, reject) => {
          sampling = { remaining: count, gl, frames: [], resolve, reject };
        });
      },
      assets: lineup.flatMap((asset) => asset.parts.map((part) => part.path)),
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
