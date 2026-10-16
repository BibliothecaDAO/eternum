import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TileOccupier } from "@bibliothecadao/types";
import { PaintedMinimapView } from "./painted-minimap";
import { HexMinimapView } from "./hex-minimap";

const props = { mapCenter: 0, cameraDistance: 20, cameraTargetHex: null, selectedHex: null, navigationTarget: null };
const occupants = [
  [TileOccupier.Spire, "spire"],
  [TileOccupier.ReservedHyperstructure, "hyperstructure"],
  [TileOccupier.Chest, "chest"],
  [TileOccupier.DormantSpire, "spire"],
  [TileOccupier.Shrine, "shrine"],
  [TileOccupier.Well, "well"],
  [TileOccupier.RealmRegularLevel2, "map-realm"],
  [TileOccupier.ExplorerKnightT1, "map-army"],
] as const;

describe("native minimap occupants", () => {
  it.each(occupants)("renders occupier %s in both renderers even without an entity ID", (type, meaning) => {
    for (const id of [undefined, "0", "42"]) {
      const tiles = [{ col: 0, row: 0, biome: 11, occupier_id: id, occupier_type: type }];
      for (const View of [HexMinimapView, PaintedMinimapView]) {
        const html = renderToStaticMarkup(<View {...props} tiles={tiles} />);
        expect(html).toContain(`data-marker="${meaning}"`);
      }
    }
  });
  it("counts non-entity sites in crowding and reveals their badges when their sector is opened", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const tiles = occupants
      .slice(0, 3)
      .map(([occupier_type], col) => ({ col, row: 0, biome: 11, occupier_id: "0", occupier_type }));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => root.render(<PaintedMinimapView {...props} tiles={tiles} />));
      expect(host.querySelector('[data-grouped="true"]')).not.toBeNull();
      const groups = [...host.querySelectorAll<HTMLButtonElement>("[data-sector]")];
      expect(groups.reduce((n, el) => n + Number(el.dataset.sites), 0)).toBe(3);
      expect(groups.reduce((n, el) => n + Number(el.dataset.armies), 0)).toBe(0);
      await act(async () => groups.find((el) => !el.disabled)!.click());
      for (const [, name] of occupants.slice(0, 3))
        expect(host.querySelector(`[data-marker="${name}"]`)).not.toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
  it("does not turn an empty tile with a stale entity ID into an occupant", () => {
    const html = renderToStaticMarkup(
      <PaintedMinimapView
        {...props}
        tiles={[{ col: 0, row: 0, occupier_id: "42", occupier_type: 0 }]}
        markers={new Map([["42", { name: "map-realm", owner: "you" }]])}
      />,
    );
    expect(html).not.toContain("data-marker=");
  });
});

it("keeps a dragged minimap view when its parent republishes the same camera coordinates", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const tiles = [{ col: 0, row: 0, biome: 11 }];
  const render = async () => {
    await act(async () =>
      root.render(<HexMinimapView {...props} tiles={tiles} cameraTargetHex={{ col: 0, row: 0 }} />),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
  };
  try {
    await render();
    const svg = host.querySelector("svg")!;
    svg.setPointerCapture = () => {};
    svg.releasePointerCapture = () => {};
    const before = svg.getAttribute("viewBox");
    await act(async () => {
      for (const [type, x, y] of [
        ["pointerdown", 50, 50],
        ["pointermove", 90, 70],
        ["pointerup", 90, 70],
      ] as const) {
        const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
        Object.defineProperty(event, "pointerId", { value: 1 });
        svg.dispatchEvent(event);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    const dragged = svg.getAttribute("viewBox");
    expect(dragged).not.toBe(before);
    await render();
    expect(svg.getAttribute("viewBox")).toBe(dragged);
    await act(async () =>
      root.render(<HexMinimapView {...props} tiles={tiles} cameraTargetHex={{ col: 4, row: 0 }} />),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(svg.getAttribute("viewBox")).not.toBe(dragged);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
