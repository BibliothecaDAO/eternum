import { Color, Matrix4, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3 } from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { Position } from "@bibliothecadao/eternum";
import { env } from "../../../env";
import { initializeRendererBackendRuntime } from "@/three/renderer-backend-runtime";
import { configureRendererColorOutput } from "@/three/renderer-color-output";
import { snapshotRendererDiagnostics } from "@/three/renderer-diagnostics";
import { createPipelineCompiler } from "@/three/pipeline-compiler";
import { configureGltfTextureSupport, gltfLoader } from "@/three/utils/utils";
import { disposeSkinnedSceneTemplates } from "@/three/characters/skinned-asset-resources";
import { ChestModelPath } from "@/three/constants/scene-constants";
import { ChestTransitions } from "@/three/rewards/chest-transitions";
import { RewardTileModel } from "@/three/rewards/reward-tile-model";
import { ModelLabEnvironment } from "@/three/debug/model-lab/model-lab-environment";
import { readModelLabSettings } from "@/three/debug/model-lab/model-lab-settings";
import { createChestLabel } from "@/three/utils/labels/label-factory";
import { CameraView } from "@/three/scenes/camera-view";
import { HoverHexManager } from "@/three/managers/hover-hex-manager";

export interface ChestProofScene {
  open(relics: readonly number[]): void;
  reset(): void;
  dispose(): void;
}

/** The game's settled model and opening pool, without a separate lab appearance policy. */
export async function mountChestProof(
  container: HTMLElement,
  signal: AbortSignal,
  onFocus: () => void,
): Promise<ChestProofScene> {
  const runtime = await initializeRendererBackendRuntime({
    envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
    isMobileDevice: false,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    search: location.search,
  });
  const renderer = runtime.renderer;
  const scene = new Scene();
  scene.background = new Color(0x819997);
  const camera = new PerspectiveCamera(36, 1, 0.05, 120);
  const target = new Vector3(0, 0.4, 0);
  camera.position.set(0, 3.8, 4.3);
  camera.lookAt(target);
  configureRendererColorOutput(renderer);
  configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);
  const environment = new ModelLabEnvironment(scene);
  const labels = new CSS2DRenderer();
  labels.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none;";
  container.append(renderer.domElement, labels.domElement);
  const plateButton = document.createElement("button");
  plateButton.type = "button";
  plateButton.setAttribute("aria-label", "Focus relic chest");
  plateButton.style.cssText = "pointer-events:auto;cursor:pointer;background:none;border:0;padding:0;";
  plateButton.append(
    createChestLabel({ entityId: 9, hexCoords: Position.fromContract({ x: 0, y: 0 }) }, CameraView.Close),
  );
  const plate = new CSS2DObject(plateButton);
  scene.add(plate);
  const hover = new HoverHexManager(scene, environment.terrain);
  let template: Awaited<ReturnType<typeof gltfLoader.loadAsync>> | undefined;
  let model: RewardTileModel | undefined;
  let transitions: ChestTransitions | undefined;
  const placement = new Matrix4();
  let disposed = false,
    frameId = 0,
    previous = performance.now();
  const focus = () => {
    if (!plate.visible || !model) return;
    hover.showHover(0, 0);
    onFocus();
  };
  plateButton.onclick = focus;
  const raycaster = new Raycaster(),
    pointer = new Vector2();
  const pick = (event: PointerEvent) => {
    if (!model || !plate.visible) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObject(model.group, true).length) focus();
  };
  renderer.domElement.addEventListener("pointerup", pick);
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    labels.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  const reset = () => {
    transitions!.clear();
    model!.setMatrixAt(0, placement);
    model!.setCount(1);
    plate.visible = true;
    hover.hideHover();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameId);
    observer.disconnect();
    renderer.domElement.removeEventListener("pointerup", pick);
    transitions?.dispose();
    if (model) model.dispose();
    else if (template) disposeSkinnedSceneTemplates([template.scene]);
    hover.dispose();
    plateButton.remove();
    environment.dispose();
    runtime.backend.dispose();
    renderer.domElement.remove();
    labels.domElement.remove();
  };
  try {
    const results = await Promise.allSettled([
      environment.update(readModelLabSettings(new URLSearchParams({ family: "knight", biome: "grassland" }))),
      gltfLoader.loadAsync(ChestModelPath).then((gltf) => {
        template = gltf;
      }),
    ]);
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    signal.throwIfAborted();
    model = new RewardTileModel(template!, 1);
    transitions = new ChestTransitions(template!);
    scene.add(model.group, transitions.group);
    placement.makeTranslation(0, environment.terrain.sampleSurface(0, 0).height + 0.05, 0);
    plate.position.set(0, placement.elements[13] + 1.5, 0);
    reset();
    resize();
    environment.frame(0, target, "day");
    const compile = createPipelineCompiler({ getRenderer: () => renderer, getCamera: () => camera });
    await compile(model.group, scene);
    await transitions.prepare(compile, scene);
    signal.throwIfAborted();
    renderer.domElement.dataset.renderer = snapshotRendererDiagnostics().activeMode ?? "unknown";
    previous = performance.now();
    const frame = () => {
      if (disposed) return;
      const now = performance.now(),
        delta = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      environment.frame(delta, target, "day");
      model!.updateAnimations(delta);
      model!.updatePresentation(0, camera.position);
      transitions!.update(delta, model!.time, camera.position);
      hover.update(delta);
      if (!plate.visible && !transitions!.has("0,0")) hover.hideHover();
      renderer.render(scene, camera);
      labels.render(scene, camera);
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return {
      reset,
      dispose,
      open: (relics) => {
        model!.setCount(0);
        transitions!.start("0,0", "open", placement, model!.time);
        transitions!.revealRelics("0,0", relics);
        plate.visible = false;
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
