import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapLayers } from "./map-layers";
import { SPIRE_WORDS } from "@/ui/design-system/kit/words";
import { PlaceSwitch } from "./surface-deep-switch";

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

const realmTab = () => host.querySelector<HTMLButtonElement>('[data-place-switch] button[aria-label="Realm"]')!;
const placeShown = () => host.querySelector<HTMLElement>("[data-place-switch]")!.dataset.place;

describe("the place switch", () => {
  it("highlights the active layer and switches straight to any unlocked depth", () => {
    const go = vi.fn();
    const onGoSurface = vi.fn();
    const layers: MapLayers = { layers: [0, 1, 2, "deep"], shown: 2, go };
    act(() => root.render(<PlaceSwitch isMapView layers={layers} onGoRealm={vi.fn()} onGoSurface={onGoSurface} />));
    expect(placeShown()).toBe("Hollow");
    expect(rowsOfMenu().map((row) => row.getAttribute("aria-selected"))).toEqual(["false", "false", "true", "false"]);
    const deep = rowsOfMenu()[3]!;
    act(() => deep.click());
    expect(go).toHaveBeenCalledWith("deep");
    const surface = rowsOfMenu()[0]!;
    act(() => surface.click());
    expect(onGoSurface).toHaveBeenCalledTimes(1);
  });

  it("opens the realm with one press of Realm, lights it while the realm stands, and names the map's layer beside it", () => {
    const onGoRealm = vi.fn();
    const layers: MapLayers = { layers: [0, 1], shown: 0, go: vi.fn() };
    const draw = (isMapView: boolean) =>
      act(() =>
        root.render(<PlaceSwitch isMapView={isMapView} layers={layers} onGoRealm={onGoRealm} onGoSurface={vi.fn()} />),
      );
    draw(true);
    expect(realmTab().getAttribute("aria-pressed")).toBe("false");
    act(() => realmTab().click());
    expect(onGoRealm).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-surface-deep-switch]")).toBeNull();
    draw(false);
    expect([realmTab().getAttribute("aria-pressed"), placeShown()]).toEqual(["true", "Realm"]);
    expect(host.querySelector("[data-place-pill]")!.textContent).toBe("Surface");
    expect(rowsOfMenu().map((row) => row.getAttribute("aria-selected"))).toEqual(["false", "false", "false", "false"]);
  });

  it("lists each layer with what stands there, each locked one with what opens it, and closes on a choice", () => {
    const go = vi.fn();
    const onSwitch = vi.fn();
    const layers: MapLayers = { layers: [0, 1], shown: 0, go };
    act(() =>
      root.render(
        <PlaceSwitch
          isMapView
          layers={layers}
          realm={{ mark: "realm-1" }}
          lines={{ surface: "1 army", 1: "0 armies" }}
          onGoRealm={vi.fn()}
          onGoSurface={vi.fn()}
          onSwitch={onSwitch}
        />,
      ),
    );
    const pill = host.querySelector<HTMLButtonElement>("[data-place-pill]")!;
    expect([placeShown(), pill.getAttribute("aria-haspopup")]).toEqual(["Surface", "true"]);
    act(() => pill.click());
    const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-surface-deep-switch] [role="tab"]')];
    expect(rows.map((row) => [row.textContent, row.getAttribute("aria-selected"), row.disabled])).toEqual([
      ["Surface1 army", "true", false],
      ["Veil0 armies", "false", false],
      [`Hollow${SPIRE_WORDS.lockedAt(2)}`, "false", true],
      [`Deep${SPIRE_WORDS.lockedAt(3)}`, "false", true],
    ]);
    act(() => rows[1]!.click());
    expect(go).toHaveBeenCalledWith(1);
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-surface-deep-switch]")).toBeNull();
  });
});
