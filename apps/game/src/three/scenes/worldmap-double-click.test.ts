import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StructureType } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";
import { type DoubleClickTarget, runWorldmapDoubleClick } from "./worldmap-double-click";

/** What a double-click on `target` did: the one action it took, or none. */
const doubleClick = (target: DoubleClickTarget) => {
  const actions = { throughSpire: vi.fn(), enterStructure: vi.fn(), foundHyperstructure: vi.fn() };
  runWorldmapDoubleClick(target, actions);
  const taken = Object.entries(actions).filter(([, action]) => action.mock.calls.length > 0);
  expect(taken.length).toBeLessThanOrEqual(1);
  return taken[0]?.[0] ?? "nothing";
};

const STRUCTURES = Object.values(StructureType).filter((value): value is StructureType => typeof value === "number");

describe("a double-click on the world map goes inside only what has an inside", () => {
  it("passes through a spire into its Ethereal layer", () => {
    expect(doubleClick({ kind: "spire" })).toBe("throughSpire");
  });

  it("opens the local view of a realm or a village, and of no other structure: a beast's lair has none", () => {
    const results = Object.fromEntries(
      STRUCTURES.map((category) => [StructureType[category], doubleClick({ kind: "structure", category })]),
    );
    expect(results).toEqual({
      Realm: "enterStructure",
      Village: "enterStructure",
      Hyperstructure: "nothing",
      Bank: "nothing",
      Mine: "nothing",
      Camp: "nothing",
      BitcoinMine: "nothing",
      Rift: "nothing",
      Ruin: "nothing",
      Beasts: "nothing",
    });
  });

  it("founds a reserved Hyperstructure site at once, and ignores an army, a chest or an empty tile", () => {
    expect(doubleClick({ kind: "reserved-hyperstructure" })).toBe("foundHyperstructure");
    expect(doubleClick({ kind: "other" })).toBe("nothing");
  });
});

it("is the world map's double-click: the scene reads its target and hands it each action", () => {
  const scene = readFileSync(join(__dirname, "worldmap.tsx"), "utf8");
  const handler = scene.slice(
    scene.indexOf("protected onHexagonDoubleClick("),
    scene.indexOf("private doubleClickTargetAt("),
  );
  expect(handler).toContain("runWorldmapDoubleClick(this.doubleClickTargetAt(hexCoords), {");
  expect(handler).toContain("throughSpire: () => this.lookThroughSpire(hexCoords)");
  expect(handler).toContain("foundHyperstructure: () => void this.createReservedHyperstructureFromWorldmap(hexCoords)");
});
