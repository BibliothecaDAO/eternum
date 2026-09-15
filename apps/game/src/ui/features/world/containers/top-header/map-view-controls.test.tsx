import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MapViewControls } from "./map-view-controls";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
});

const render = (compact: boolean, mapLayer = false, onLayerChange = vi.fn()) =>
  act(async () =>
    root.render(
      <MapViewControls
        compact={compact}
        isLocalView={false}
        mapLayer={mapLayer}
        showLayerSwitch
        onNavigate={vi.fn()}
        onLayerChange={onLayerChange}
      />,
    ),
  );

it("collapses the mobile layer picker into one descriptive toggle", async () => {
  const onLayerChange = vi.fn();
  await render(true, false, onLayerChange);
  const layerGroup = container.querySelector('[role="group"][aria-label="Map layer"]')!;
  const layerButton = layerGroup.querySelector("button")!;

  expect(layerGroup.querySelectorAll("button")).toHaveLength(1);
  expect(layerButton.textContent).toBe("Surface");
  expect(layerButton.getAttribute("aria-label")).toBe("Map layer: Surface. Switch to Ethereal");
  await act(async () => layerButton.click());
  expect(onLayerChange).toHaveBeenCalledWith(true);
});

it("keeps both explicit layer choices in the desktop header", async () => {
  await render(false, true);
  const layerButtons = container.querySelectorAll('[role="group"][aria-label="Map layer"] button');

  expect([...layerButtons].map((button) => button.textContent)).toEqual(["Surface", "Ethereal"]);
  expect(layerButtons[1].getAttribute("aria-pressed")).toBe("true");
});
