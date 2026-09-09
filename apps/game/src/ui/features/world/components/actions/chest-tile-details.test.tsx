import { readFileSync } from "node:fs";
import { isTileOccupierStructure } from "@bibliothecadao/eternum";
import { TileOccupier } from "@bibliothecadao/types";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./unoccupied-tile-quadrants", () => ({
  BiomeSummaryCard: ({ coordsLabel }: { coordsLabel?: string }) => <article>Biome {coordsLabel} +30%</article>,
}));
import { ChestTileDetails } from "./chest-tile-details";
it("stacks crate content above one biome card carrying the coordinates", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <ChestTileDetails crateEntityId={99} biome={"Beach" as never} coordsLabel="(3, 4)" onSimulateBattle={() => {}} />,
  );
  expect(container.textContent).toContain("Relic Crate");
  expect(container.textContent).toContain("Crate #99");
  expect(container.querySelectorAll("article")).toHaveLength(1);
  expect(container.querySelector("article")?.textContent).toContain("(3, 4)");
  expect(container.querySelector("section")?.nextElementSibling?.tagName).toBe("ARTICLE");
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
