import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  type Object3D,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { initializeProceduralCharacterRendererRuntime } from "../../../characters/procedural-character-renderer-runtime";
import { configureRendererColorOutput } from "../../../renderer-color-output";
import { configureWorldSunShadows } from "../../../effects/world-sun-shadows";
import { resetGameEnd } from "../../../effects/endgame/state";
import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../../../scenes/worldmap-camera-view-profile";
import { ARMY_MODEL_SCALE, buildArmyModelAssetPath } from "../../../constants/army-constants";
import { ModelType } from "../../../types/army";
import { REALM_ASSETS } from "../../../structures/realm-design";
import { gltfLoader } from "../../../utils/utils";
import { buildApproach, type BiomeRewriteApproach } from "./approaches";
import { createSandWaterWorld, resolveCoastalStage } from "./sand-water-world";

export interface BiomeRewriteSettings {
  approach: BiomeRewriteApproach;
  view: "play" | "close";
}

export interface BiomeRewriteStats {
  triangles: number;
  materials: number;
  buildMs: number;
  sceneDraws: number;
}

const VIEW_DISTANCE = { play: 14, close: 7 } as const;

/** One sand-and-water region built by one approach, with a realm and an army on its coast. */
export async function mountBiomeRewrite(
  container: HTMLElement,
  settings: BiomeRewriteSettings,
  signal: AbortSignal,
  onStats: (stats: BiomeRewriteStats) => void,
) {
  resetGameEnd();
  const initialized = await initializeProceduralCharacterRendererRuntime({ pixelRatioCap: 1.5, preloadPhysics: false });
  const renderer = initialized.rendererRuntime.renderer;
  configureRendererColorOutput(renderer);
  renderer.shadowMap.enabled = true;
  const scene = new Scene();
  scene.background = new Color("#a9c9d6");
  const sun = new DirectionalLight("#fff1d6", 2.3);
  sun.position.set(-14, 22, 10);
  configureWorldSunShadows(sun, true, 2048);
  scene.add(sun, sun.target, new HemisphereLight("#cfe4f2", "#8c7a58", 0.9), new AmbientLight("#ffffff", 0.25));
  const camera = new PerspectiveCamera(resolveWorldmapCameraFieldOfViewDegrees(), 1, 0.1, 300);
  const controls = new OrbitControls(camera, renderer.domElement);
  let frame = 0;
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
    initialized.unitRuntime.dispose();
    initialized.rendererRuntime.backend.dispose();
    renderer.domElement.remove();
  };
  try {
    container.append(renderer.domElement);
    observer.observe(container);
    resize();
    const startedAt = performance.now();
    const world = createSandWaterWorld();
    const built = buildApproach(settings.approach, world);
    const buildMs = performance.now() - startedAt;
    scene.add(built.group, createOpenSea(built.seaLevel));
    const stage = resolveCoastalStage(world);
    const [realm, army] = await Promise.all([
      gltfLoader.loadAsync(REALM_ASSETS[2].path),
      gltfLoader.loadAsync(buildArmyModelAssetPath(ModelType.Knight2)),
    ]);
    signal.throwIfAborted();
    stand(realm.scene, stage.realm.x, stage.realm.z, built.standAt(stage.realm.x, stage.realm.z), 1);
    stand(army.scene, stage.army.x, stage.army.z, built.standAt(stage.army.x, stage.army.z), ARMY_MODEL_SCALE);
    scene.add(realm.scene, army.scene);
    const focus = new Vector3((stage.realm.x + stage.army.x) / 2, 0.3, (stage.realm.z + stage.army.z) / 2);
    sun.target.position.copy(focus);
    sun.position.copy(focus).add(new Vector3(-14, 22, 10));
    frameCamera(camera, controls, focus, VIEW_DISTANCE[settings.view]);
    const render = () => {
      if (signal.aborted) return;
      controls.update();
      renderer.render(scene, camera);
      onStats({
        triangles: built.triangles,
        materials: built.materials,
        buildMs,
        sceneDraws: renderer.info.render.calls,
      });
      frame = requestAnimationFrame(render);
    };
    render();
    return { dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

function stand(model: Object3D, x: number, z: number, y: number, scale: number): void {
  model.position.set(x, y, z);
  model.scale.setScalar(scale);
  model.traverse((node) => {
    if (node instanceof Mesh) node.castShadow = node.receiveShadow = true;
  });
}

/** Deep water beyond the region, so every approach is framed the same way. */
function createOpenSea(level: number): Mesh {
  const sea = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({ color: "#1a4a78", roughness: 0.3 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = level;
  return sea;
}

function frameCamera(camera: PerspectiveCamera, controls: OrbitControls, focus: Vector3, distance: number) {
  controls.target.copy(focus);
  const pitch = resolveWorldmapCameraPitchRadians(distance);
  camera.position.copy(focus).add(new Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(distance));
  controls.update();
}
