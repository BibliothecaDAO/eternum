import { BatchedMesh, Color, PerspectiveCamera, Scene, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { initializeProceduralCharacterRendererRuntime } from "../../../characters/procedural-character-renderer-runtime";
import { configureRendererColorOutput } from "../../../renderer-color-output";
import { resetGameEnd } from "../../../effects/endgame/state";
import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../../../scenes/worldmap-camera-view-profile";
import { isTerrainArmySpaceClear } from "../../../terrain/terrain-army-clearance";
import { findNearestTerrainHex, terrainHexToWorld } from "../../../terrain/terrain-coordinates";
import { ModelLabEnvironment } from "../model-lab-environment";
import { readModelLabSettings } from "../model-lab-settings";
import { composeBiomeTarget, type BiomeStudyId } from "./biome-target-composition";
import { drawStudyProps } from "../study-props";

export interface ProceduralBiomesSettings {
  biome: BiomeStudyId;
  look: "today" | "target";
  distance: number;
}

export interface ProceduralBiomesStats {
  props: number;
  studyDraws: number;
  sceneDraws: number;
}

/** One biome's patch on the client's terrain: the game's own props, or the study's composition of the same meshes. */
export async function mountProceduralBiomes(
  container: HTMLElement,
  settings: ProceduralBiomesSettings,
  signal: AbortSignal,
  onStats: (stats: ProceduralBiomesStats) => void,
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
  let batch: BatchedMesh | null = null;
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
    batch?.dispose();
    environment.dispose();
    initialized.unitRuntime.dispose();
    initialized.rendererRuntime.backend.dispose();
    renderer.domElement.remove();
  };
  try {
    container.append(renderer.domElement);
    observer.observe(container);
    resize();
    await environment.update(readModelLabSettings(new URLSearchParams(`family=knight&biome=${settings.biome}`)));
    signal.throwIfAborted();
    const target = settings.look === "target";
    environment.terrain.refreshPropOccupancy(() => target);
    let props = 0;
    if (target) {
      const composed = composeBiomeTarget(settings.biome, isClearOfArmies);
      batch = await drawStudyProps(composed, (x, z) => environment.terrain.sampleSurface(x, z).height);
      signal.throwIfAborted();
      scene.add(batch);
      props = composed.length;
    }
    frameCamera(camera, controls, settings.distance);
    const render = () => {
      if (signal.aborted) return;
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      environment.frame(delta, controls.target, "day");
      controls.update();
      renderer.render(scene, camera);
      onStats({ props, studyDraws: batch ? 1 : 0, sceneDraws: renderer.info.render.calls });
      frame = requestAnimationFrame(render);
    };
    render();
    return { dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

/** Props keep the hex centre an army stands on clear, as the game's own placement does. */
function isClearOfArmies(x: number, z: number): boolean {
  const hex = findNearestTerrainHex(x, z);
  const center = terrainHexToWorld(hex.col, hex.row);
  return isTerrainArmySpaceClear(x - center.x, z - center.z);
}

function frameCamera(camera: PerspectiveCamera, controls: OrbitControls, distance: number) {
  controls.target.set(0, 0.3, 0.8);
  const pitch = resolveWorldmapCameraPitchRadians(distance);
  camera.position.copy(controls.target).add(new Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(distance));
  controls.update();
}
