import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { runWorldmapDoubleClick } from "./worldmap-double-click";

const actionsWith = (reserved: boolean) => ({
  isReservedHyperstructureSite: vi.fn(() => reserved),
  foundHyperstructure: vi.fn(),
  enterStructure: vi.fn(),
});

it("founds a Hyperstructure on a double-click on its reserved site, at once", () => {
  const actions = actionsWith(true);
  runWorldmapDoubleClick({ col: 4, row: 5 }, actions);
  expect(actions.foundHyperstructure).toHaveBeenCalledWith({ col: 4, row: 5 });
  expect(actions.enterStructure).not.toHaveBeenCalled();
});

it("enters the structure on any other tile double-clicked", () => {
  const actions = actionsWith(false);
  runWorldmapDoubleClick({ col: 4, row: 5 }, actions);
  expect(actions.enterStructure).toHaveBeenCalledWith({ col: 4, row: 5 });
  expect(actions.foundHyperstructure).not.toHaveBeenCalled();
});

it("is the world map's double-click: the scene founds a reserved site through it", () => {
  const scene = readFileSync(join(__dirname, "worldmap.tsx"), "utf8");
  const handler = scene.slice(
    scene.indexOf("protected onHexagonDoubleClick("),
    scene.indexOf("private enterStructureFromSelectedHex("),
  );
  expect(handler).toContain("runWorldmapDoubleClick(hexCoords, {");
  expect(handler).toContain("isReservedHyperstructureSite: (hex) => this.isReservedHyperstructureHex(hex)");
  expect(handler).toContain("foundHyperstructure: (hex) => void this.createReservedHyperstructureFromWorldmap(hex)");
});
