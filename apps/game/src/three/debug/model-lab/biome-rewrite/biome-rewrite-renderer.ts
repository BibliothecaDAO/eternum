import { BiomeType } from "@bibliothecadao/types";
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
import { buildBiomeTerrain } from "./biome-terrain";
import { biomeCentre, createBiomeWorld, resolveStage, type BiomeField } from "./biome-world";

export interface BiomeRewriteSettings {
  field: BiomeField;
  /** The whole field, or one biome up close with the realm and army standing in it. */
  focus: BiomeType | "field";
}

export interface BiomeRewriteStats {
  triangles: number;
  props: number;
  batches: number;
  buildMs: number;
  sceneDraws: number;
}

const FIELD_DISTANCE = 30;
const CLOSE_DISTANCE = 9;

/** The field drawn by approach 1 (one heightfield, shaders for every biome and the water), realm and army on it. */
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
    const world = createBiomeWorld(settings.field);
    const { minX, maxX, minZ, maxZ } = world.bounds;
    const fieldCentre = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
    const focus = settings.focus === "field" ? fieldCentre : biomeCentre(world, settings.focus);
    const stage = resolveStage(world, focus);
    const terrain = await buildBiomeTerrain(world, new Set([`${stage.realm.col}:${stage.realm.row}`]));
    const buildMs = performance.now() - startedAt;
    signal.throwIfAborted();
    scene.add(terrain.group, createOpenSea());
    const [realm, army] = await Promise.all([
      gltfLoader.loadAsync(REALM_ASSETS[2].path),
      gltfLoader.loadAsync(buildArmyModelAssetPath(ModelType.Knight2)),
    ]);
    signal.throwIfAborted();
    stand(realm.scene, stage.realm.x, stage.realm.z, world.heightAt(stage.realm.x, stage.realm.z), 1);
    stand(army.scene, stage.army.x, stage.army.z, world.heightAt(stage.army.x, stage.army.z), ARMY_MODEL_SCALE);
    scene.add(realm.scene, army.scene);
    const target =
      settings.focus === "field"
        ? new Vector3(fieldCentre.x, 0.2, fieldCentre.z + 1.5)
        : new Vector3((stage.realm.x + stage.army.x) / 2, 0.3, (stage.realm.z + stage.army.z) / 2);
    sun.target.position.copy(target);
    sun.position.copy(target).add(new Vector3(-14, 22, 10));
    frameCamera(camera, controls, target, settings.focus === "field" ? FIELD_DISTANCE : CLOSE_DISTANCE);
    const render = () => {
      if (signal.aborted) return;
      controls.update();
      renderer.render(scene, camera);
      onStats({
        triangles: terrain.triangles,
        props: terrain.props,
        batches: terrain.batches,
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
  model.position.set(x, Math.max(y, 0), z);
  model.scale.setScalar(scale);
  model.traverse((node) => {
    if (node instanceof Mesh) node.castShadow = node.receiveShadow = true;
  });
}

/** Deep water beyond the field, so its edges read as coast, not as the end of the world. */
function createOpenSea(): Mesh {
  const sea = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({ color: "#1a4a78", roughness: 0.3 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.06;
  return sea;
}

function frameCamera(camera: PerspectiveCamera, controls: OrbitControls, target: Vector3, distance: number) {
  controls.target.copy(target);
  const pitch = resolveWorldmapCameraPitchRadians(distance);
  camera.position.copy(target).add(new Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(distance));
  controls.update();
}
