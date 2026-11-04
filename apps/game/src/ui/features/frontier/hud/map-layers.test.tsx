import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapViewControls } from "@/ui/features/world/containers/top-header/map-view-controls";

import { layerChoices, layerMark, layerName, type MapLayers, viewChoice } from "./map-layers";
import { PlaceNav } from "./place-nav";

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

/** The open list's choices, each by its word and whether it is the one shown. */
const openList = () =>
  [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((item) => [
    item.textContent,
    item.getAttribute("aria-checked"),
  ]);
const choose = (word: string) =>
  act(() =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="menu"] button')]
      .find((item) => item.textContent === word)!
      .click(),
  );

// A realm with Ethereal I and II researched, the camera in Ethereal II.
const layersShowingII = (go: MapLayers["go"]): MapLayers => ({ layers: [0, 1, 2], shown: 2, go });

describe("the map's layers", () => {
  it("on a phone, the view slot names the layer shown and opens Realm, the world and each Ethereal layer", () => {
    const go = vi.fn();
    const onGo = vi.fn();
    const layers = layersShowingII(go);
    const views = {
      icon: layerMark(layers.shown),
      word: layerName(layers.shown),
      items: [viewChoice("Realm", "realm", false, () => onGo("realm")), ...layerChoices(layers)],
    };
    act(() => root.render(<PlaceNav place={null} onRealm={false} onGo={onGo} views={views} events={0} unread={0} />));
    const slot = host.querySelector<HTMLButtonElement>("[data-switch]")!;
    expect(slot.textContent).toBe("Ethereal II");
    expect(slot.querySelector("img")?.getAttribute("src")).toContain("depth-2");

    act(() => slot.click());
    expect(openList()).toEqual([
      ["Realm", "false"],
      ["World", "false"],
      ["Ethereal I", "false"],
      ["Ethereal II", "true"],
    ]);
    expect(onGo).not.toHaveBeenCalled();
    choose("Ethereal I");
    expect(go).toHaveBeenCalledWith(1);
    expect(openList()).toEqual([]);

    act(() => slot.click());
    choose("Ethereal II");
    expect(go).toHaveBeenCalledTimes(1);
    act(() => slot.click());
    choose("Realm");
    expect(onGo).toHaveBeenCalledWith("realm");
  });

  it("on a desktop, the World tab names the layer shown and opens the same layers, Realm staying its own tab", () => {
    const go = vi.fn();
    const onNavigate = vi.fn();
    const layers = layersShowingII(go);
    act(() =>
      root.render(
        <MapViewControls
          compact={false}
          isLocalView={false}
          canOpenLocal
          mapLayer={false}
          showLayerSwitch={false}
          worldTab={{ label: layerName(layers.shown), menu: layerChoices(layers) }}
          onNavigate={onNavigate}
          onLayerChange={vi.fn()}
        />,
      ),
    );
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute("aria-selected")])).toEqual([
      ["Realm", "false"],
      ["Ethereal II", "true"],
    ]);

    act(() => tabs[1].click());
    expect(openList()).toEqual([
      ["World", "false"],
      ["Ethereal I", "false"],
      ["Ethereal II", "true"],
    ]);
    expect(onNavigate).not.toHaveBeenCalled();
    choose("World");
    expect(go).toHaveBeenCalledWith(0);

    act(() => tabs[0].click());
    expect(onNavigate).toHaveBeenCalledWith(false);
  });
});
