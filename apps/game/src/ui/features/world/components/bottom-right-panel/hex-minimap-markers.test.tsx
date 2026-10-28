const gameMode = vi.hoisted(() => ({ id: "blitz" }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => gameMode }));
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TileOccupier } from "@bibliothecadao/types";

import { HexMinimap } from "./hex-minimap";

// One known entity, a player's realm with id 42; the game's synchronized configuration is not this test's business.
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => new Map([["42", { name: "map-realm", owner: "own" }]]) }));
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
      navigationTarget={null}
      cameraTargetHex={null}
    />,
  );

describe("a site the world places with no entity of its own", () => {
  it.each([
    [TileOccupier.Spire, "spire"],
    [TileOccupier.DormantSpire, "spire"],
    [TileOccupier.Shrine, "shrine"],
    [TileOccupier.Well, "well"],
    [TileOccupier.ReservedHyperstructure, "hyperstructure"],
    [TileOccupier.Chest, "chest"],
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
