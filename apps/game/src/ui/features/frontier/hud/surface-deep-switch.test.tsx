import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapLayers } from "./map-layers";
import { SurfaceDeepSwitch } from "./surface-deep-switch";

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

describe("SurfaceDeepSwitch", () => {
  it("stays hidden before depth is unlocked or while on the realm board", () => {
    const go = vi.fn();
    act(() => root.render(<SurfaceDeepSwitch layers={{ layers: [0], shown: 0, go }} />));
    expect(host.querySelector("[data-surface-deep-switch]")).toBeNull();

    act(() => root.render(<SurfaceDeepSwitch layers={{ layers: [0, "deep"], shown: null, go }} />));
    expect(host.querySelector("[data-surface-deep-switch]")).toBeNull();
  });

  it("toggles directly between Surface and a single unlocked depth", () => {
    const go = vi.fn();
    const onSwitch = vi.fn();
    const layers: MapLayers = { layers: [0, "deep"], shown: 0, go };
    act(() => root.render(<SurfaceDeepSwitch layers={layers} onSwitch={onSwitch} />));

    const buttons = [...host.querySelectorAll<HTMLButtonElement>("[data-surface-deep-switch] button")];
    expect(buttons.map((button) => [button.textContent, button.getAttribute("aria-pressed")])).toEqual([
      ["Surface", "true"],
      ["Deep", "false"],
    ]);

    act(() => buttons[1]!.click());
    expect(go).toHaveBeenCalledWith("deep");
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it("opens the depth list when multiple depths are unlocked", () => {
    const go = vi.fn();
    const layers: MapLayers = { layers: [0, 1, 2, "deep"], shown: 1, go };
    act(() => root.render(<SurfaceDeepSwitch layers={layers} />));

    const buttons = [...host.querySelectorAll<HTMLButtonElement>("[data-surface-deep-switch] button")];
    expect(buttons.map((button) => [button.textContent, button.getAttribute("aria-pressed")])).toEqual([
      ["Surface", "false"],
      ["Veil", "true"],
    ]);

    act(() => buttons[1]!.click());
    const items = [...document.querySelectorAll<HTMLButtonElement>('[role="menu"] [role^="menuitem"]')];
    expect(items.map((item) => item.textContent)).toEqual(["Veil", "Hollow", "Deep"]);

    act(() => items[2]!.click());
    expect(go).toHaveBeenCalledWith("deep");
  });
});
