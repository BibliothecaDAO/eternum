import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapViewControls } from "@/ui/features/world/containers/top-header/map-view-controls";

import { SpireTravelModal } from "./spire-travel-modal";
import { ETERNUM_MAP_NAMES } from "@bibliothecadao/types";

const army = vi.hoisted(() => ({ alt: false }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({
  useNativeRow: () => ({ game_id: 1 }),
  useNativeRevision: () => {},
}));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: { getActiveGameId: () => 1 },
  entityMapPosition: () => ({ alt: army.alt, x: 4, y: 7 }),
  getTileAt: () => undefined,
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const mapSwitch = (compact: boolean, mapLayer: boolean) =>
  act(() =>
    root.render(
      <MapViewControls
        compact={compact}
        isLocalView={false}
        canOpenLocal
        mapLayer={mapLayer}
        showLayerSwitch
        onNavigate={vi.fn()}
        onLayerChange={vi.fn()}
      />,
    ),
  );

const crossing = (alt: boolean) => {
  army.alt = alt;
  act(() => root.render(<SpireTravelModal explorerId={9} essenceCost={5} onTravelThroughSpire={vi.fn()} />));
  return {
    preview: [...host.querySelectorAll("p")].find((node) => node.textContent?.startsWith("Your hex on"))?.textContent,
    button: [...host.querySelectorAll("button")].map((node) => node.textContent),
  };
};

describe("Eternum's spire destination", () => {
  it("has one name on the map's layer switch, the crossing's preview and its button", () => {
    const tabs = () => {
      const layerTab = [...host.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent === "Surface");
      return [...layerTab!.closest('[role="tablist"]')!.querySelectorAll('[role="tab"]')].map((tab) => [
        tab.textContent,
        tab.getAttribute("aria-selected"),
      ]);
    };
    mapSwitch(false, true);
    expect(tabs()).toEqual([
      ["Surface", "false"],
      [ETERNUM_MAP_NAMES[1], "true"],
    ]);
    mapSwitch(false, false);
    expect(tabs()).toEqual([
      ["Surface", "true"],
      [ETERNUM_MAP_NAMES[1], "false"],
    ]);
    const compactSwitch = () => host.querySelector('button[aria-label^="Map layer:"]');
    mapSwitch(true, true);
    expect([compactSwitch()?.textContent, compactSwitch()?.getAttribute("aria-label")]).toEqual([
      ETERNUM_MAP_NAMES[1],
      "Map layer: Ethereal Layer. Switch to Surface",
    ]);
    mapSwitch(true, false);
    expect([compactSwitch()?.textContent, compactSwitch()?.getAttribute("aria-label")]).toEqual([
      "Surface",
      "Map layer: Surface. Switch to Ethereal Layer",
    ]);

    expect(crossing(false)).toEqual({
      preview: "Your hex on the Ethereal Layer is clear",
      button: expect.arrayContaining(["Enter the Ethereal Layer"]),
    });
    expect(crossing(true)).toEqual({
      preview: "Your hex on the Surface is clear",
      button: expect.arrayContaining(["Return to the Surface"]),
    });
  });
});
