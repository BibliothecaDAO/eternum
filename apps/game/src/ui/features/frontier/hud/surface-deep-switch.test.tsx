import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapLayers } from "./map-layers";
import { FrontierPlaceSwitch, PlaceMenu } from "./surface-deep-switch";

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
  vi.clearAllMocks();
});

describe("FrontierPlaceSwitch", () => {
  it("renders all five places inline on a desktop with exact catalog accessible names and lock states", () => {
    const go = vi.fn();
    const onGoRealm = vi.fn();
    const onGoSurface = vi.fn();
    const onSwitch = vi.fn();
    const layers: MapLayers = { layers: [0, 1], shown: 0, go };

    act(() =>
      root.render(
        <FrontierPlaceSwitch
          isMapView
          layers={layers}
          onGoRealm={onGoRealm}
          onGoSurface={onGoSurface}
          onSwitch={onSwitch}
        />,
      ),
    );

    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Map view"] [role="tab"]')];
    expect(
      tabs.map((tab) => ({
        label: tab.textContent,
        ariaLabel: tab.getAttribute("aria-label"),
        selected: tab.getAttribute("aria-selected"),
        disabled: tab.disabled,
        tip: tab.getAttribute("data-tip"),
      })),
    ).toEqual([
      { label: "Realm", ariaLabel: "Realm", selected: "false", disabled: false, tip: null },
      { label: "Surface", ariaLabel: "Surface", selected: "true", disabled: false, tip: null },
      { label: "Veil", ariaLabel: "Veil", selected: "false", disabled: false, tip: null },
      { label: "Hollow", ariaLabel: "Hollow", selected: "false", disabled: true, tip: "Spire II" },
      { label: "Deep", ariaLabel: "Deep", selected: "false", disabled: true, tip: "Spire III" },
    ]);
    expect(document.querySelector('[role="menu"]')).toBeNull();

    act(() => tabs[0]!.click());
    expect(onGoRealm).toHaveBeenCalledTimes(1);

    act(() => tabs[2]!.click());
    expect(go).toHaveBeenCalledWith(1);
    expect(onSwitch).toHaveBeenCalledTimes(1);

    act(() => tabs[3]!.click());
    expect(go).toHaveBeenCalledTimes(1);
  });

  it("highlights the active deep layer or Realm and switches straight to any unlocked depth", () => {
    const go = vi.fn();
    const onGoRealm = vi.fn();
    const onGoSurface = vi.fn();
    const layers: MapLayers = { layers: [0, 1, 2, "deep"], shown: 2, go };

    act(() =>
      root.render(<FrontierPlaceSwitch isMapView layers={layers} onGoRealm={onGoRealm} onGoSurface={onGoSurface} />),
    );
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Map view"] [role="tab"]')];
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "false", "false", "true", "false"]);
    act(() => tabs[4]!.click());
    expect(go).toHaveBeenCalledWith("deep");

    act(() =>
      root.render(
        <FrontierPlaceSwitch isMapView={false} layers={layers} onGoRealm={onGoRealm} onGoSurface={onGoSurface} />,
      ),
    );
    const realmTabs = [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Map view"] [role="tab"]')];
    expect(realmTabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
      "false",
      "false",
    ]);
    act(() => realmTabs[1]!.click());
    expect(onGoSurface).toHaveBeenCalledTimes(1);
  });

  it("lists the same five places in a phone's menu, each locked one with what opens it, and closes on a choice", () => {
    const go = vi.fn();
    const onSwitch = vi.fn();
    const layers: MapLayers = { layers: [0, 1], shown: 0, go };
    act(() =>
      root.render(
        <PlaceMenu
          isMapView
          layers={layers}
          realm={{ name: "Duskbite", mark: "realm-1" }}
          onGoRealm={vi.fn()}
          onGoSurface={vi.fn()}
          onSwitch={onSwitch}
        />,
      ),
    );
    const pill = host.querySelector<HTMLButtonElement>("[data-place-pill]")!;
    expect([pill.dataset.place, pill.getAttribute("aria-haspopup")]).toEqual(["Surface", "true"]);
    act(() => pill.click());
    const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-surface-deep-switch] [role="tab"]')];
    expect(rows.map((row) => [row.textContent, row.getAttribute("aria-selected"), row.disabled])).toEqual([
      ["RealmDuskbite", "false", false],
      ["Surface", "true", false],
      ["Veil", "false", false],
      ["HollowSpire II", "false", true],
      ["DeepSpire III", "false", true],
    ]);
    act(() => rows[2]!.click());
    expect(go).toHaveBeenCalledWith(1);
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-surface-deep-switch]")).toBeNull();
  });
});
