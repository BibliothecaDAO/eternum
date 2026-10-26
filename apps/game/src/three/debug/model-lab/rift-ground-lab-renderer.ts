import { Color, Matrix4, Mesh, PerspectiveCamera, Scene, Vector3 } from "three";
import type { MeshStandardNodeMaterial } from "three/webgpu";
import type { RendererSurfaceLike } from "../../renderer-backend";
import { StructureType } from "@bibliothecadao/types";
import { initializeProceduralCharacterRendererRuntime } from "../../characters/procedural-character-renderer-runtime";
import { getRendererDiagnosticActiveMode } from "../../renderer-diagnostics";
import { configureRendererColorOutput } from "../../renderer-color-output";
import { resetGameEnd } from "../../effects/endgame/state";
import InstancedModel from "../../managers/instanced-model";
import { FrontierModel } from "../../structures/frontier-model";
import { FRONTIER_BEASTS, frontierBeast, frontierSiteComposition } from "../../structures/frontier-beast";
import { frontierPaintedPath } from "../../structures/frontier-painted-buildings";
import { gltfLoader } from "../../utils/utils";
import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../../scenes/worldmap-camera-view-profile";
import { ModelLabEnvironment } from "./model-lab-environment";
import { readModelLabSettings } from "./model-lab-settings";
import { createRiftGroundMaterial } from "./rift-ground-material";

export interface RiftGroundLabSettings {
  biome: "grassland" | "desert" | "snow";
  view: "detail" | "play";
}

/** One scene and one renderer, drawn twice: identical terrain, beast, lighting and camera in both comparisons. */
export async function mountRiftGroundLab(
  host: HTMLElement,
  panels: readonly HTMLElement[],
  settings: RiftGroundLabSettings,
  signal: AbortSignal,
) {
  resetGameEnd();
  const runtime = await initializeProceduralCharacterRendererRuntime({ pixelRatioCap: 1.5, preloadPhysics: false });
  const renderer = runtime.rendererRuntime.renderer as RendererSurfaceLike & {
    setScissorTest(enabled: boolean): void;
    setViewport(x: number, y: number, width: number, height: number): void;
    setScissor(x: number, y: number, width: number, height: number): void;
  };
  configureRendererColorOutput(renderer);
  renderer.shadowMap.enabled = true;
  const scene = new Scene();
  scene.background = new Color(0x819997);
  const environment = new ModelLabEnvironment(scene);
  const cameras = panels.map(() => new PerspectiveCamera(resolveWorldmapCameraFieldOfViewDegrees(), 1, 0.1, 150));
  const models: InstancedModel[] = [];
  const ground: { mesh: Mesh; source: MeshStandardNodeMaterial; proposal: MeshStandardNodeMaterial }[] = [];
  const treatments = new Map<MeshStandardNodeMaterial, MeshStandardNodeMaterial>();
  let frame = 0;
  let disposed = false;
  let current = settings;
  let last = performance.now();
  let captures = 0;
  const resize = () => renderer.setSize(host.clientWidth, host.clientHeight);
  const observer = new ResizeObserver(resize);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    models.forEach((model) => model.dispose());
    ground.forEach(({ mesh, source }) => {
      mesh.material = source;
    });
    environment.dispose();
    treatments.forEach((material) => material.dispose());
    runtime.unitRuntime.dispose();
    runtime.rendererRuntime.backend.dispose();
    renderer.domElement.remove();
  };
  try {
    signal.throwIfAborted();
    host.prepend(renderer.domElement);
    observer.observe(host);
    resize();
    await environment.update(readModelLabSettings(new URLSearchParams(`family=knight&biome=${settings.biome}`)));
    signal.throwIfAborted();
    environment.terrain.object3d.traverse((object) => {
      if (!(object instanceof Mesh) || object.name !== "procedural-terrain-land") return;
      const source = object.material as MeshStandardNodeMaterial;
      let treatment = treatments.get(source);
      if (!treatment) {
        treatment = createRiftGroundMaterial(source);
        treatments.set(source, treatment);
      }
      ground.push({ mesh: object, source, proposal: treatment });
    });
    if (!ground.length) throw new Error("Rift comparison has no terrain surface");
    const base = new InstancedModel(await gltfLoader.loadAsync(frontierPaintedPath("essence-rift")), 1, false, "Rift");
    models.push(base);
    const beast = new FrontierModel(await gltfLoader.loadAsync(FRONTIER_BEASTS["dark-fey"].path), 1, "dark-fey");
    models.push(beast);
    signal.throwIfAborted();
    const height = environment.terrain.sampleSurface(0, 0).height;
    const composition = frontierSiteComposition(StructureType.Rift);
    base.setMatrixAt(
      0,
      new Matrix4().makeTranslation(0, height, composition.baseZ).scale(new Vector3().setScalar(composition.baseScale)),
    );
    beast.setMatrixAt(
      0,
      new Matrix4()
        .makeTranslation(0, height + composition.beastY, composition.beastZ)
        .scale(new Vector3().setScalar(frontierBeast(0, StructureType.Rift).scale)),
    );
    models.forEach((model) => {
      model.setCount(1);
      scene.add(model.group);
    });
    const drawCounts = { base: 0, beast: 0 };
    for (const [kind, model] of [
      ["base", base],
      ["beast", beast],
    ] as const) {
      for (const mesh of model.instancedMeshes) {
        const after = mesh.onAfterRender;
        mesh.onAfterRender = (...args) => {
          after.apply(mesh, args);
          if (cameras.includes(args[2] as PerspectiveCamera)) drawCounts[kind]++;
        };
      }
    }
    const target = new Vector3(0, height + 0.2, 0);
    const render = () => {
      if (disposed || signal.aborted) return;
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      environment.frame(delta, target, "day");
      models.forEach((model) => model.updateAnimations(delta));
      const distance = current.view === "detail" ? 5 : 20;
      const hostRect = host.getBoundingClientRect();
      const measurements = [];
      renderer.setScissorTest(true);
      for (const [index, panel] of panels.entries()) {
        const camera = cameras[index];
        camera.position
          .copy(target)
          .add(
            new Vector3(
              0,
              Math.sin(resolveWorldmapCameraPitchRadians(distance)),
              Math.cos(resolveWorldmapCameraPitchRadians(distance)),
            ).multiplyScalar(distance),
          );
        camera.lookAt(target);
        const rect = panel.getBoundingClientRect();
        const x = rect.left - hostRect.left;
        const y = rect.top - hostRect.top;
        renderer.setViewport(x, y, rect.width, rect.height);
        renderer.setScissor(x, y, rect.width, rect.height);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        base.group.visible = index === 0;
        ground.forEach(({ mesh, source, proposal }) => {
          mesh.material = index === 0 ? source : proposal;
        });
        drawCounts.base = drawCounts.beast = 0;
        renderer.info.reset();
        renderer.render(scene, camera);
        measurements.push({
          kind: index === 0 ? "current" : "proposal",
          calls: renderer.info.render.drawCalls ?? renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          cameraDistance: distance,
          baseDraws: drawCounts.base,
          beastDraws: drawCounts.beast,
          groundProbes: [-0.65, 0.65].map((x) => {
            const projected = new Vector3(x, environment.terrain.sampleSurface(x, 0).height, 0).project(camera);
            return {
              x: rect.left + ((projected.x + 1) * rect.width) / 2,
              y: rect.top + ((1 - projected.y) * rect.height) / 2,
            };
          }),
          outsideProbes: [-1.35, 1.35].map((x) => {
            const projected = new Vector3(x, environment.terrain.sampleSurface(x, 0).height, 0).project(camera);
            return {
              x: rect.left + ((projected.x + 1) * rect.width) / 2,
              y: rect.top + ((1 - projected.y) * rect.height) / 2,
            };
          }),
        });
      }
      renderer.setScissorTest(false);
      if (++captures > 3)
        host.dataset.riftRendered = JSON.stringify({
          ...current,
          backend: getRendererDiagnosticActiveMode(),
          panels: measurements,
          beastScale: frontierBeast(0, StructureType.Rift).scale,
          beastY: composition.beastY,
        });
      frame = requestAnimationFrame(render);
    };
    render();
    return {
      dispose,
      update(next: RiftGroundLabSettings) {
        current = next;
        captures = 0;
        delete host.dataset.riftRendered;
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
