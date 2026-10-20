// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

// What the minimap draws is not this test's business, only whether the HUD shows it.
vi.mock("@/ui/features/world/components/bottom-right-panel", () => ({
  useMinimapReading: () => ({
    tiles: [],
    isLoading: false,
    cameraTargetHex: null,
    selectedHex: null,
    navigationTarget: null,
  }),
}));
vi.mock("@/ui/features/world/components/bottom-right-panel/hex-minimap", () => ({
  HexMinimap: () => <svg data-minimap />,
}));

import { HudMinimap } from "./minimap";

const view = (scene: "map" | "hex") =>
  act(() => {
    window.history.pushState({}, "", `/g/0xa/3/${scene}`);
    window.dispatchEvent(new Event("urlChanged"));
  });

const host = document.createElement("div");
const root = createRoot(host);
afterEach(() => act(() => root.render(null)));

it("draws the minimap on the world map, and no empty panel in the realm view", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  view("map");
  act(() => root.render(<HudMinimap />));
  expect(host.querySelector("[data-minimap]")).not.toBeNull();
  view("hex");
  expect(host.innerHTML).toBe("");
  view("map");
  expect(host.querySelector("[data-minimap]")).not.toBeNull();
});
