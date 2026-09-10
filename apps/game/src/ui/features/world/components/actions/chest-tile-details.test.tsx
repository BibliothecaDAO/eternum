import { existsSync, readFileSync } from "node:fs";
import { isTileOccupierStructure } from "@bibliothecadao/eternum";
import { ResourcesIds, TileOccupier } from "@bibliothecadao/types";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./unoccupied-tile-quadrants", () => ({
  BiomeSummaryCard: ({ coordsLabel }: { coordsLabel?: string }) => <article>Biome {coordsLabel ?? ""} +30%</article>,
}));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({
  ResourceIcon: ({ resource }: { resource: string }) => <i data-icon={resource} />,
}));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: { getRelicCrateReward: () => ({ relicsPerCrate: 3, victoryPoints: 250 }) },
}));
import { ChestTileDetails } from "./chest-tile-details";
const render = (props: Partial<Parameters<typeof ChestTileDetails>[0]> = {}) => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <ChestTileDetails
      crateEntityId={99}
      biome={"Beach" as never}
      coordsLabel="Relic Tile · (3, 4)"
      opening={null}
      onSimulateBattle={() => {}}
      {...props}
    />,
  );
  return container;
};
const openButton = (container: HTMLElement) =>
  [...container.querySelectorAll("button")].find((button) => button.textContent === "Open");

it("builds the crate panel from the structure tile chrome with contents read from config", () => {
  const container = render();
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

it("offers Open only while one of the player's armies stands next to the crate", () => {
  const blocked = openButton(render({ openBlockedReason: "Move one of your armies next to the crate." }))!;
  expect(blocked.disabled).toBe(true);
  expect(blocked.title).toBe("Move one of your armies next to the crate.");
  expect(blocked.className).toContain("font-sans");
  const ready = openButton(render({ onOpen: () => {} }))!;
  expect(ready.disabled).toBe(false);
  expect(ready.title).toBe("");
});

it("lists the relics once the crate is opened and drops the Open action", () => {
  const container = render({
    crateEntityId: null,
    opening: {
      explorerId: 7,
      hex: { x: 3, y: 4 },
      relics: [ResourcesIds.StaminaRelic1, ResourcesIds.StaminaRelic1],
      timestamp: 1,
    },
  });
  expect(container.textContent).toContain("Crate opened");
  expect(container.querySelector('img[src="/images/relic-chest/chest-opened.png"]')).not.toBeNull();
  const relics = container.querySelector('[aria-label="Relics found"]')!;
  expect(relics.querySelectorAll("li")).toHaveLength(2);
  expect(relics.textContent).toContain("Stamina Relic I");
  expect(relics.querySelectorAll("[data-icon='StaminaRelic1']")).toHaveLength(2);
  expect(openButton(container)).toBeUndefined();
  expect(container.textContent).not.toMatch(/Victory points|Crate #/);
});

it("has no crate modal left: opening happens from the map or the tile panel", () => {
  expect(existsSync("src/ui/features/military/chest/chest-modal.tsx")).toBe(false);
  expect(existsSync("src/ui/features/military/chest/chest-container.tsx")).toBe(false);
  expect(readFileSync("src/ui/features/military/index.ts", "utf8")).not.toContain("Chest");
  expect(readFileSync("src/three/scenes/worldmap.tsx", "utf8")).toContain("void openRelicCrate({");
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
