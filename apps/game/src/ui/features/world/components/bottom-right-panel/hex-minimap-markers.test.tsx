const gameMode = vi.hoisted(() => ({ id: "blitz" }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => gameMode }));
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TileOccupier } from "@bibliothecadao/types";

import { HexMinimap } from "./hex-minimap";

// One known entity, a player's realm with id 42; the game's synchronized configuration is not this test's business.
vi.mock("@/hooks/use-fact-view", () => ({
  useFactView: () =>
    new Map([
      ["42", { name: "map-realm", owner: "own" }],
      ["43", { name: "flame", owner: "enemy", undefended: true, scale: 1.75 }],
      ["44", { name: "lock", owner: "nobody", scale: 1.45 }],
    ]),
}));
vi.mock("@/ui/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/config")>()),
  FELT_CENTER: () => 0,
}));

/** The minimap drawn with one tile, occupied as the world says, carrying this entity id. */
const draw = (occupierType: number, occupierId = "0") =>
  renderToStaticMarkup(
    <HexMinimap
      tiles={[{ col: 0, row: 0, biome: 11, occupier_type: occupierType, occupier_id: occupierId }]}
      selectedHex={null}
      cameraTargetHex={null}
    />,
  );

describe("a site the world places with no entity of its own", () => {
  it.each([
    [TileOccupier.Spire, "spire"],
    [TileOccupier.DormantSpire, "spire"],
    [TileOccupier.ReservedHyperstructure, "hyperstructure"],
    [TileOccupier.Chest, "chest"],
    [TileOccupier.SupplyPost, "camp"],
  ])("draws occupier %s as its %s", (type, meaning) => {
    expect(draw(Number(type))).toContain(`data-marker="${meaning}"`);
  });
});

describe("an entity on the tile", () => {
  it("draws a live entity's own marker", () => {
    expect(draw(TileOccupier.RealmRegularLevel1, "42")).toContain('data-marker="map-realm" data-owner="own"');
  });

  it("draws nothing on an empty tile that still carries a stale entity id", () => {
    expect(draw(TileOccupier.None, "42")).not.toContain("data-marker=");
  });
});

it("uses the game's category meaning before an encounter's entity facts arrive", () => {
  try {
    gameMode.id = "frontier";
    expect(draw(TileOccupier.Camp)).toContain('data-marker="beast-troll"');
    expect(draw(TileOccupier.Beasts)).toContain('data-marker="beast-cyclops"');
    gameMode.id = "blitz";
    expect(draw(TileOccupier.Camp)).toContain('data-marker="camp"');
  } finally {
    gameMode.id = "blitz";
  }
});

describe("a Deep site marker", () => {
  const scaleOf = (markup: string, marker: string) =>
    Number(new RegExp(`scale\\(([\\d.]+)\\)" data-marker="${marker}"`).exec(markup)![1]);

  it("draws open/held sites at 1.75x with a dashed edge when undefended, and locked sites smaller at 1.45x", () => {
    const site = draw(TileOccupier.DeepSite, "43");
    const locked = draw(TileOccupier.DeepSite, "44");
    const realm = draw(TileOccupier.RealmRegularLevel1, "42");
    expect(site).toContain('data-marker="flame" data-owner="enemy"');
    expect(site).toContain('stroke-dasharray="3.4 2.2"');
    expect(locked).toContain('data-marker="lock" data-owner="nobody"');
    expect(locked).not.toContain("stroke-dasharray=");
    expect(realm).not.toContain("stroke-dasharray=");
    expect(scaleOf(site, "flame")).toBeGreaterThan(scaleOf(locked, "lock"));
    expect(scaleOf(locked, "lock")).toBeGreaterThan(scaleOf(realm, "map-realm"));
  });

  it("paints markers after every terrain tile so enlarged Deep sites sit above neighbouring hexes", () => {
    const markup = renderToStaticMarkup(
      <HexMinimap
        tiles={[
          { col: 0, row: 0, biome: 11, occupier_type: TileOccupier.DeepSite, occupier_id: "43" },
          { col: 1, row: 0, biome: 11 },
        ]}
        selectedHex={null}
        cameraTargetHex={null}
      />,
    );
    const lastTerrainPolygon = markup.indexOf('fill-opacity="0.92"', markup.indexOf('fill-opacity="0.92"') + 1);
    const markerIndex = markup.indexOf('data-marker="flame"');
    expect(lastTerrainPolygon).toBeGreaterThan(-1);
    expect(markerIndex).toBeGreaterThan(lastTerrainPolygon);
  });
});
