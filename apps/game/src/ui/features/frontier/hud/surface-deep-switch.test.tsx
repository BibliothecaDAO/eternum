import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapLayers } from "./map-layers";
import { PlaceMenu } from "./surface-deep-switch";

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

const rowsOfMenu = () => {
  if (!document.querySelector("[data-surface-deep-switch]"))
    act(() => host.querySelector<HTMLButtonElement>("[data-place-pill]")!.click());
  return [...document.querySelectorAll<HTMLButtonElement>('[data-surface-deep-switch] [role="tab"]')];
};

describe("the place menu", () => {
  it("highlights the active deep layer or Realm and switches straight to any unlocked depth", () => {
    const go = vi.fn();
    const onGoRealm = vi.fn();
    const onGoSurface = vi.fn();
    const layers: MapLayers = { layers: [0, 1, 2, "deep"], shown: 2, go };

    act(() => root.render(<PlaceMenu isMapView layers={layers} onGoRealm={onGoRealm} onGoSurface={onGoSurface} />));
    expect(rowsOfMenu().map((row) => row.getAttribute("aria-selected"))).toEqual([
      "false",
      "false",
      "false",
      "true",
      "false",
    ]);
    act(() => rowsOfMenu()[4]!.click());
    expect(go).toHaveBeenCalledWith("deep");

    act(() =>
      root.render(<PlaceMenu isMapView={false} layers={layers} onGoRealm={onGoRealm} onGoSurface={onGoSurface} />),
    );
    expect(rowsOfMenu().map((row) => row.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
      "false",
      "false",
    ]);
    act(() => rowsOfMenu()[1]!.click());
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
          realm={{ mark: "realm-1" }}
          lines={{ realm: "Duskbite" }}
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
