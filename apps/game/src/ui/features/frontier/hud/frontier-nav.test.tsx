import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";

import { PhoneTabBar, type HudSurface } from "./frontier-nav";
import { selectLayer } from "./map-layers";
import { useOnePanel } from "./one-panel";
import { useHudPopover } from "./hud-popover";
import { PlaceSwitch } from "./surface-deep-switch";

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
      <PlaceSwitch
        isMapView
        layers={layers}
        onGoRealm={() => openSurface(null)}
        onGoSurface={() => selectLayer(layers, 0, () => openSurface(null))}
        onSwitch={() => openSurface(null)}
      />
      <PhoneTabBar surface={surface} onSurface={openSurface} feedUnread={0} chatUnread={0} />
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
const choosePlace = (word: string) => {
  act(() => document.querySelector<HTMLButtonElement>("[data-place-pill]")!.click());
  act(() => document.querySelector<HTMLButtonElement>(`[role="tab"][aria-label="${word}"]`)!.click());
};
const page = () => host.querySelector("[data-page]")!.textContent;

it.each(["research", "feed", "chat", "menu"] as const)(
  "a layer choice puts the open %s page away, so the map shows the layer",
  (open) => {
    go.mockClear();
    act(() => root.render(<PhoneHud open={open} />));
    press("Open page");
    expect(page()).toBe(open);
    choosePlace("Veil");
    expect(go).toHaveBeenCalledWith(1);
    expect(page()).toBe("map");
  },
);

it("pressing Surface puts the open page away and returns to Surface", () => {
  go.mockClear();
  act(() => root.render(<PhoneHud open="research" />));
  press("Open page");
  choosePlace("Surface");
  expect(go).toHaveBeenCalledWith(0);
  expect(page()).toBe("map");
});

it("choosing the layer already shown puts the page away without moving the map", () => {
  go.mockClear();
  act(() => root.render(<PhoneHud open="research" />));
  press("Open page");
  choosePlace("Hollow");
  expect(go).not.toHaveBeenCalled();
  expect(page()).toBe("map");
});

function SurfacePopover() {
  const { triggerProps, popover } = useHudPopover({ surface: true });
  return (
    <>
      <button type="button" {...triggerProps}>
        Quest
      </button>
      {popover(<p data-quest-card>Today's quest</p>, { className: "", layout: "phone" })}
    </>
  );
}

function PhoneHudWithQuest() {
  const { surface, openSurface } = useOnePanel(null, true);
  return (
    <>
      <output data-page>{surface ?? "map"}</output>
      <SurfacePopover />
      <button onClick={() => openSurface("today")}>Open page</button>
    </>
  );
}

it("puts the open page away when the quest's card opens on a phone, and closes the card when a page opens", () => {
  const card = () => document.querySelector("[data-quest-card]");
  act(() => root.render(<PhoneHudWithQuest />));
  press("Open page");
  expect(page()).toBe("today");
  press("Quest");
  expect([page(), card() !== null]).toEqual(["map", true]);
  press("Open page");
  expect([page(), card() !== null]).toEqual(["today", false]);
});
