import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selectedHex: null as null | { col: number; row: number },
  selectedBuildingHex: { structureId: 1, innerCol: 2, innerRow: 3 } as null | {
    structureId: number;
    innerCol: number;
    innerRow: number;
  },
  mapLayer: false,
}));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: (pick: (s: typeof state) => unknown) => pick(state) }));
vi.mock("@/hooks/helpers/use-tile-at", () => ({ useTileAt: () => undefined, useStoredBiome: () => "Grassland" }));
vi.mock("../components/bottom-right-panel/bottom-right-panel", () => ({
  useSelectedTileDetails: () => <button>Inspect selected tile</button>,
}));
import { SelectedTileSummary } from "./selected-tile-summary";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  state.selectedHex = null;
  state.selectedBuildingHex = { structureId: 1, innerCol: 2, innerRow: 3 };
});

describe("active scene tile inspection", () => {
  it("inspects a local building without a prior world click, switches scenes, and ignores stale selections", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const show = async (scene: string) => {
      await act(async () => {
        history.pushState({}, "", `/g/0x1/1/${scene}`);
        window.dispatchEvent(new Event("urlChanged"));
        root.render(<SelectedTileSummary />);
      });
    };
    try {
      await show("hex");
      expect(host.textContent).toContain("Inspect selected tile");
      expect(host.textContent).toContain("(2, 3)");
      expect(host.textContent).not.toContain("Grassland");
      state.selectedHex = { col: 8, row: 9 };
      await show("map");
      expect(host.textContent).toContain("Tile · (8, 9)");
      expect(host.textContent).toContain("Grassland");
      await show("hex");
      expect(host.textContent).toContain("(2, 3)");
      expect(host.textContent).not.toContain("(8, 9)");
      state.selectedBuildingHex = null;
      await show("hex");
      expect(host.textContent).toBe("");
      state.selectedHex = null;
      await show("map");
      expect(host.textContent).toBe("");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
