import { readFileSync } from "node:fs";
import { isTileOccupierStructure } from "@bibliothecadao/eternum";
import { TileOccupier } from "@bibliothecadao/types";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./unoccupied-tile-quadrants", () => ({
  BiomeSummaryCard: ({ coordsLabel }: { coordsLabel?: string }) => <article>Biome {coordsLabel ?? ""} +30%</article>,
}));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: { getRelicCrateReward: () => ({ relicsPerCrate: 3, victoryPoints: 250 }) },
}));
import { ChestTileDetails } from "./chest-tile-details";
it("builds the crate panel from the structure tile chrome with contents read from config", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <ChestTileDetails
      crateEntityId={99}
      biome={"Beach" as never}
      coordsLabel="Relic Tile · (3, 4)"
      onSimulateBattle={() => {}}
    />,
  );
  const header = container.querySelector('[aria-expanded="true"]')!;
  expect(header.textContent).toBe("Relic Tile · (3, 4)");
  expect(header.querySelector("svg")).not.toBeNull();
  expect(container.textContent).toContain("Crate #99");
  expect(container.querySelector('img[src="/images/relic-chest/chest-closed.png"]')).not.toBeNull();
  expect(container.textContent).toContain("Contents");
  expect(container.textContent).toContain("Relics3");
  expect(container.textContent).toContain("Victory points250");
  expect(container.textContent).not.toMatch(/1000|discover/);
  expect(container.querySelectorAll("article")).toHaveLength(1);
  expect(container.querySelector("article")?.textContent).not.toContain("(3, 4)");
  expect(container.innerHTML).not.toMatch(/h-full|overflow-y-auto|grid-rows/);
});

it("classifies the live chest row by occupier type rather than its immovable-occupier flag", () => {
  const liveChest = { occupier_type: TileOccupier.Chest, occupier_is_structure: true };
  expect(isTileOccupierStructure(liveChest.occupier_type)).toBe(false);
  for (const path of [
    "src/ui/features/world/components/actions/selected-worldmap-entity.tsx",
    "src/ui/features/world/components/bottom-right-panel/bottom-right-panel.tsx",
    "src/ui/features/world/components/bottom-right-panel/hex-minimap.tsx",
  ]) {
    const source = readFileSync(path, "utf8");
    expect(source).not.toMatch(/occupier_is_structure\)?\s*\|\|/);
    expect(source).toContain("isTileOccupierStructure(occupierType)");
  }
});
