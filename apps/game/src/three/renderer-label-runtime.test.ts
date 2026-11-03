// @vitest-environment jsdom
import { PerspectiveCamera, Scene } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { afterEach, describe, expect, it } from "vitest";

import { createRendererLabelRuntime } from "./renderer-label-runtime";

/** The world UI's label layer, as `ui/layouts/world.tsx` mounts it with a game's page. */
const mountLabelLayer = () => {
  const layer = document.createElement("div");
  layer.id = "labelrenderer";
  document.body.appendChild(layer);
  return layer;
};

/** A scene with one label in front of the camera. */
const sceneWithLabel = () => {
  const scene = new Scene();
  const element = document.createElement("div");
  element.textContent = "Spire";
  const label = new CSS2DObject(element);
  label.position.set(0, 0, -5);
  scene.add(label);
  const camera = new PerspectiveCamera(60, 390 / 844, 0.1, 100);
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  return { scene, camera, element };
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("renderer label runtime", () => {
  it("draws the scene's labels into the label layer mounted with the game's page", () => {
    const layer = mountLabelLayer();
    const runtime = createRendererLabelRuntime({ isMobileDevice: true });
    const { scene, camera, element } = sceneWithLabel();

    expect(runtime.isReady()).toBe(true);
    runtime.render(scene, camera);

    expect(element.parentElement).toBe(layer);
    expect(element.style.display).not.toBe("none");
  });

  it("waits while no label layer is mounted", () => {
    const runtime = createRendererLabelRuntime({ isMobileDevice: true });
    const { scene, camera, element } = sceneWithLabel();

    expect(runtime.isReady()).toBe(false);
    runtime.render(scene, camera);

    expect(element.parentElement).toBeNull();
  });

  it("draws into the new label layer after the game's page is left and entered again", () => {
    const first = mountLabelLayer();
    const runtime = createRendererLabelRuntime({ isMobileDevice: true });
    const { scene, camera, element } = sceneWithLabel();
    runtime.render(scene, camera);

    // Leaving the game unmounts its page, the label layer with it, while the renderer stays booted for a return.
    first.remove();
    expect(runtime.isReady()).toBe(false);

    const second = mountLabelLayer();
    expect(runtime.isReady()).toBe(true);
    runtime.render(scene, camera);

    expect(element.parentElement).toBe(second);
    expect(element.isConnected).toBe(true);
  });

  it("asks for a label draw as soon as a new layer is mounted", () => {
    const runtime = createRendererLabelRuntime({ isMobileDevice: true });
    const drawNow = { cadenceView: "close" as const, labelsActive: true, now: 1_000 };
    mountLabelLayer();
    runtime.isReady();
    expect(runtime.shouldRender(drawNow)).toBe(true);
    // Drawn, and nothing changed since: the next frame within the cadence waits.
    expect(runtime.shouldRender({ ...drawNow, now: 1_001 })).toBe(false);

    document.getElementById("labelrenderer")!.remove();
    runtime.isReady();
    mountLabelLayer();
    runtime.isReady();

    expect(runtime.shouldRender({ ...drawNow, now: 1_002 })).toBe(true);
  });

  it("draws nothing once disposed", () => {
    const layer = mountLabelLayer();
    const runtime = createRendererLabelRuntime({ isMobileDevice: true });
    const { scene, camera } = sceneWithLabel();
    runtime.render(scene, camera);

    runtime.dispose();

    expect(layer.children).toHaveLength(0);
    expect(runtime.isReady()).toBe(false);
  });
});
