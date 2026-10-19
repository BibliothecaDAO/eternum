import { Box3, Color, Matrix4, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { initializeProceduralCharacterRendererRuntime } from "../../characters/procedural-character-renderer-runtime";
import { CAMP_MODEL_PATH, BEASTS_MODEL_PATH } from "../../constants/scene-constants";
import { configureRendererColorOutput } from "../../renderer-color-output";
import { resetGameEnd } from "../../effects/endgame/state";
import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../../scenes/worldmap-camera-view-profile";
import { SettlementModel } from "../../structures/settlement-model";
import { gltfLoader } from "../../utils/utils";
import { ModelLabEnvironment } from "./model-lab-environment";
import { readModelLabSettings } from "./model-lab-settings";

export type ClearedSiteStudy = "camp" | "beasts";
import { CLEARED_SITE_MODEL_PATH } from "../../constants/scene-constants";

/** Existing world renderer, terrain, camera and ownership material; only the proposed marker is a lab asset. */
export async function mountClearedSiteStudy(
  container: HTMLElement,
  settings: { kind: ClearedSiteStudy; distance: number },
  signal: AbortSignal,
  select: (cleared: boolean) => void,
) {
  resetGameEnd();
  const runtime = await initializeProceduralCharacterRendererRuntime({ pixelRatioCap: 1.5, preloadPhysics: false });
  const renderer = runtime.rendererRuntime.renderer;
  configureRendererColorOutput(renderer);
  renderer.shadowMap.enabled = true;
  const scene = new Scene();
  scene.background = new Color(0x819997);
  const environment = new ModelLabEnvironment(scene);
  const camera = new PerspectiveCamera(resolveWorldmapCameraFieldOfViewDegrees(), 1, 0.1, 150);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 5;
  controls.maxDistance = 35;
  const models: SettlementModel[] = [];
  const targets: Array<{ bounds: Box3; cleared: boolean }> = [];
  let frame = 0;
  let last = performance.now();
  let pressed = new Vector2();
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  const press = (event: PointerEvent) => {
    pressed = new Vector2(event.clientX, event.clientY);
  };
  const pick = (event: PointerEvent) => {
    if (pressed.distanceTo(new Vector2(event.clientX, event.clientY)) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const point = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2,
    );
    const ray = new Raycaster();
    ray.setFromCamera(point, camera);
    const hits = targets
      .flatMap((target) => {
        const point = ray.ray.intersectBox(target.bounds, new Vector3());
        return point ? [{ cleared: target.cleared, distance: point.distanceTo(camera.position) }] : [];
      })
      .sort((a, b) => a.distance - b.distance);
    if (hits[0]) select(hits[0].cleared);
  };
  const dispose = () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    renderer.domElement.removeEventListener("pointerdown", press);
    renderer.domElement.removeEventListener("pointerup", pick);
    controls.dispose();
    models.forEach((model) => model.dispose());
    environment.dispose();
    runtime.unitRuntime.dispose();
    runtime.rendererRuntime.backend.dispose();
    renderer.domElement.remove();
  };
  try {
    signal.throwIfAborted();
    container.append(renderer.domElement);
    observer.observe(container);
    resize();
    await environment.update(readModelLabSettings(new URLSearchParams("family=knight&biome=grassland")));
    signal.throwIfAborted();
    const paths = [settings.kind === "camp" ? CAMP_MODEL_PATH : BEASTS_MODEL_PATH, CLEARED_SITE_MODEL_PATH];
    for (const [slot, path] of paths.entries()) {
      const gltf = await gltfLoader.loadAsync(path);
      const model = new SettlementModel(gltf, 1);
      models.push(model);
      await model.prepare();
      signal.throwIfAborted();
      const x = (slot === 0 ? -1 : 1) * Math.sqrt(3);
      const placement = new Matrix4().makeTranslation(x, environment.terrain.sampleSurface(x, 0).height, 0);
      model.setMatrixAt(0, placement);
      model.setCount(1);
      model.setRelationshipAt(0, slot === 0 ? "enemy" : "owned");
      // The instanced renderer leaves picking to its scene; review uses each delivered model's bounds.
      targets.push({ bounds: new Box3().setFromObject(gltf.scene).applyMatrix4(placement), cleared: slot === 1 });
      scene.add(model.group);
    }
    controls.target.set(0, environment.terrain.sampleSurface(0, 0).height + 0.35, 0);
    const pitch = resolveWorldmapCameraPitchRadians(settings.distance);
    camera.position
      .copy(controls.target)
      .add(new Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(settings.distance));
    controls.update();
    renderer.domElement.addEventListener("pointerdown", press);
    renderer.domElement.addEventListener("pointerup", pick);
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
    return { dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
