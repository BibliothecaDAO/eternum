import { PerspectiveCamera, Scene } from "three";
import { describe, expect, it, vi } from "vitest";
import type { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import type { PreparedTerrainPage, TerrainPageRequest } from "@/three/terrain/terrain-types";
import { createTerrainVerificationRequest } from "@/three/terrain/verification/terrain-verification-fixtures";
import { terrainNeighborCoordinates } from "@/three/terrain/terrain-coordinates";
import { DEFAULT_TERRAIN_LAB_PREVIEW } from "./terrain-lab-preview";

vi.mock("@/three/managers/hover-hex-manager", () => ({
  HoverHexManager: class {
    update() {}
    showHover() {}
    hideHover() {}
    dispose() {}
  },
}));
vi.mock("@/three/managers/instanced-model", () => ({ default: class {} }));
vi.mock("@/three/utils/utils", () => ({ gltfLoader: {} }));
const { TerrainLabInteraction } = await import("./terrain-lab-interaction");

function createHarness() {
  const request = createTerrainVerificationRequest("tropical-coast");
  const terrain = {
    preparePageAsync: vi.fn(async (request: TerrainPageRequest) => ({ request }) as PreparedTerrainPage),
    prepareFogMaskAsync: vi.fn(async () => null),
    present: vi.fn(),
    queueShroudReveal: vi.fn(),
    cancelShroudReveals: vi.fn(),
    sampleSurface: vi.fn(() => ({ height: 0 })),
    refreshPropOccupancy: vi.fn(),
    setSurfacePresentation: vi.fn(),
  };
  const canvas = { addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as HTMLCanvasElement;
  const interaction = new TerrainLabInteraction(
    canvas,
    new PerspectiveCamera(),
    new Scene(),
    terrain as unknown as ProceduralTerrain,
    request,
    vi.fn(),
    vi.fn(),
  );
  return { terrain, interaction };
}

describe("lab exploration preview", () => {
  it("switches Ethereal presentation with the committed page and restores world presentation", async () => {
    const { terrain, interaction } = createHarness();
    await interaction.configure({ ...DEFAULT_TERRAIN_LAB_PREVIEW, biome: "ethereal" });
    expect(terrain.setSurfacePresentation).toHaveBeenLastCalledWith("ethereal");
    expect(terrain.setSurfacePresentation.mock.invocationCallOrder[0]).toBeLessThan(
      terrain.present.mock.invocationCallOrder[0],
    );
    await interaction.configure(DEFAULT_TERRAIN_LAB_PREVIEW);
    expect(terrain.setSurfacePresentation).toHaveBeenLastCalledWith("world");
    interaction.dispose();
  });

  it("does not switch presentation for stale asynchronous Ethereal preparation", async () => {
    const { terrain, interaction } = createHarness();
    let finish: (() => void) | undefined;
    terrain.preparePageAsync.mockImplementationOnce(
      (request) =>
        new Promise((resolve) => {
          finish = () => resolve({ request } as PreparedTerrainPage);
        }),
    );
    const pending = interaction.configure({ ...DEFAULT_TERRAIN_LAB_PREVIEW, biome: "ethereal" });
    await interaction.configure(DEFAULT_TERRAIN_LAB_PREVIEW);
    finish!();
    await pending;
    expect(terrain.setSurfacePresentation).toHaveBeenCalledOnce();
    expect(terrain.setSurfacePresentation).toHaveBeenCalledWith("world");
    interaction.dispose();
  });

  it("preserves existing fixture reveals during initial and default configuration", async () => {
    const { terrain, interaction } = createHarness();
    await interaction.configure(DEFAULT_TERRAIN_LAB_PREVIEW);
    await interaction.configure({ ...DEFAULT_TERRAIN_LAB_PREVIEW, yaw: 0.5 });
    expect(terrain.cancelShroudReveals).not.toHaveBeenCalled();
    expect(terrain.present).not.toHaveBeenCalled();
    interaction.dispose();
  });

  it("replays a preview by cancelling only the previously owned sweep", async () => {
    const { terrain, interaction } = createHarness();
    await interaction.previewExploration(0);
    expect(terrain.cancelShroudReveals).not.toHaveBeenCalled();
    interaction.update(0.016);
    interaction.update(0.016);
    await interaction.previewExploration(3);
    expect(terrain.cancelShroudReveals).toHaveBeenCalledTimes(1);
    interaction.update(0.016);
    interaction.update(0.016);
    expect(terrain.queueShroudReveal).toHaveBeenCalledTimes(2);
    interaction.dispose();
  });

  it("cancels a pending preview when buildings are removed without replaying it", async () => {
    const { terrain, interaction } = createHarness();
    await interaction.removeBuilding(true);
    expect(terrain.cancelShroudReveals).not.toHaveBeenCalled();
    await interaction.previewExploration(0);
    await interaction.removeBuilding(true);
    interaction.update(0.016);
    interaction.update(0.016);
    expect(terrain.cancelShroudReveals).toHaveBeenCalledTimes(1);
    expect(terrain.queueShroudReveal).not.toHaveBeenCalled();
    interaction.dispose();
  });

  it.each([0, 1, 2, 3, 4, 5])("uses the production queue after one covered frame from entry edge %i", async (edge) => {
    const { terrain, interaction } = createHarness();
    const before = interaction.getState();
    await interaction.previewExploration(edge);
    const selectedCell = (prepared: PreparedTerrainPage) =>
      prepared.request.cells.find((c) => c.col === before.selected.col && c.row === before.selected.row)!;
    expect(selectedCell(terrain.present.mock.calls[0][0][0]).explored).toBe(false);
    interaction.update(0.016);
    expect(terrain.queueShroudReveal).not.toHaveBeenCalled();
    interaction.update(0.016);
    expect(terrain.queueShroudReveal).toHaveBeenCalledWith(
      before.selected.col,
      before.selected.row,
      terrainNeighborCoordinates(before.selected.col, before.selected.row)[edge],
    );
    expect(selectedCell(terrain.present.mock.calls[1][0][0]).explored).toBe(true);
    expect(interaction.getState()).toEqual(before);
    interaction.dispose();
  });

  it("cancels a pending reveal when lab configuration changes", async () => {
    const { terrain, interaction } = createHarness();
    await interaction.previewExploration(0);
    await interaction.configure({ ...DEFAULT_TERRAIN_LAB_PREVIEW, fog: "clear" });
    interaction.update(0.016);
    interaction.update(0.016);
    expect(terrain.queueShroudReveal).not.toHaveBeenCalled();
    expect(terrain.cancelShroudReveals).toHaveBeenCalled();
    expect(terrain.present.mock.calls.at(-1)![0][0].request.cells.every((c: { explored: boolean }) => c.explored)).toBe(
      true,
    );
    interaction.dispose();
  });

  it("discards stale asynchronous preview work after reconfiguration", async () => {
    const { terrain, interaction } = createHarness();
    const pending: Array<() => void> = [];
    terrain.preparePageAsync.mockImplementationOnce(
      (request) => new Promise((resolve) => pending.push(() => resolve({ request } as PreparedTerrainPage))),
    );
    const preview = interaction.previewExploration(0);
    await interaction.configure({ ...DEFAULT_TERRAIN_LAB_PREVIEW, fog: "clear" });
    const count = terrain.present.mock.calls.length;
    pending.forEach((resolve) => resolve());
    await preview;
    interaction.update(0.016);
    expect(terrain.present).toHaveBeenCalledTimes(count);
    expect(terrain.queueShroudReveal).not.toHaveBeenCalled();
    interaction.dispose();
  });
});
