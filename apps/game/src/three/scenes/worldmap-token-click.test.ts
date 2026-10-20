// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

const { default: WorldmapScene } = await import("./worldmap");

/**
 * The world map with a label layer whose resting tokens stand where the test says, an army and a structure placed on
 * their tiles, and the tile the pointer is over when no token is: the scene's own click resolution, as a click reaches
 * it (owner, 2026-10-20: a click on a token selects its thing, as a click on its tile does).
 */
const sceneWith = (tokenAt: (x: number, y: number) => string | null) => {
  const clicked: unknown[] = [];
  const scene = Object.assign(Object.create(WorldmapScene.prototype), {
    mapPlates: { tokenAt },
    armyManager: {
      getArmy: (id: number) => (id === 7 ? { hexCoords: { getNormalized: () => ({ x: 12, y: 30 }) } } : undefined),
    },
    structureManager: { getStructureHex: (id: number) => (id === 9 ? { col: 4, row: 5 } : undefined) },
    interactiveHexManager: { onClick: () => ({ hexCoords: { col: 12, row: 29 }, position: {} }) },
    onHexagonClick: (hex: unknown) => clicked.push(hex),
  });
  const click = (x: number, y: number) =>
    (scene as { handleClick: (event: MouseEvent, raycaster: unknown) => void }).handleClick(
      new MouseEvent("click", { clientX: x, clientY: y }),
      {},
    );
  return { click, clicked };
};

describe("a click on a map token (qa-fresh-chain-frontier-1 #1: the tile behind was selected)", () => {
  it("selects the army or structure the token belongs to, at its own tile", () => {
    const { click, clicked } = sceneWith((x) => (x === 100 ? "army:7" : x === 200 ? "structure:9" : null));
    click(100, 50);
    click(200, 50);
    expect(clicked).toEqual([
      { col: 12, row: 30 },
      { col: 4, row: 5 },
    ]);
  });

  it("leaves every other click to the tile under the pointer: the map, an open plate (not a token)", () => {
    const { click, clicked } = sceneWith(() => null);
    click(300, 50);
    expect(clicked).toEqual([{ col: 12, row: 29 }]);
  });

  it("falls back to the tile under the pointer when the token's thing has no tile on the map", () => {
    const { click, clicked } = sceneWith(() => "army:99");
    click(100, 50);
    expect(clicked).toEqual([{ col: 12, row: 29 }]);
  });
});
