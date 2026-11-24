import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";

import { PhoneWorldActions, type HudSurface } from "./frontier-nav";
import { selectLayer } from "./map-layers";
import { useOnePanel } from "./one-panel";
import { FrontierPlaceSwitch } from "./surface-deep-switch";

vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("../frontier-home", () => ({ useGoToFrontierPlace: () => vi.fn() }));
vi.mock("../research/research-facts", () => ({ useResearchTree: () => null }));
vi.mock("../research/research-tree", () => ({ canResearchNow: () => false }));

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

/**
 * A phone's HUD on the map in Ethereal II: the place bar with its view list, the one panel deciding which page stands
 * over the map, and the map's own move, which lets go of the selection as the scene does.
 */
const go = vi.fn(() => useUIStore.getState().selectOnMap(null));
function PhoneHud({ open }: { open: HudSurface }) {
  const { surface, openSurface } = useOnePanel(null, true);
  const layers = { layers: [0, 1, 2] as const, shown: 2 as const, go };
  return (
    <>
      <output data-page>{surface ?? "map"}</output>
      <FrontierPlaceSwitch
        isMapView
        variant="phone"
        layers={layers}
        onGoRealm={() => openSurface(null)}
        onGoSurface={() => selectLayer(layers, 0, () => openSurface(null))}
        onSwitch={() => openSurface(null)}
      />
      <PhoneWorldActions surface={surface} onSurface={openSurface} events={0} unread={0} />
      <button onClick={() => openSurface(open)}>Open page</button>
    </>
  );
}
const press = (word: string) =>
  act(() =>
    [...document.querySelectorAll("button")]
      .find((button) => button.getAttribute("aria-label") === word || button.textContent === word)!
      .click(),
  );
const page = () => host.querySelector("[data-page]")!.textContent;

it.each(["research", "feed", "chat", "menu"] as const)(
  "a layer choice puts the open %s page away, so the map shows the layer",
  (open) => {
    go.mockClear();
    act(() => root.render(<PhoneHud open={open} />));
    press("Open page");
    expect(page()).toBe(open);
    press("Veil");
    expect(go).toHaveBeenCalledWith(1);
    expect(page()).toBe("map");
  },
);

it("pressing Surface puts the open page away and returns to Surface", () => {
  go.mockClear();
  act(() => root.render(<PhoneHud open="research" />));
  press("Open page");
  press("Surface");
  expect(go).toHaveBeenCalledWith(0);
  expect(page()).toBe("map");
});

it("choosing the layer already shown puts the page away without moving the map", () => {
  go.mockClear();
  act(() => root.render(<PhoneHud open="research" />));
  press("Open page");
  press("Hollow");
  expect(go).not.toHaveBeenCalled();
  expect(page()).toBe("map");
});
