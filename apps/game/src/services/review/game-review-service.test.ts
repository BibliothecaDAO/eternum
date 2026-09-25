// @vitest-environment node
import { expect, it, vi } from "vitest";
import { buildMapSnapshot } from "./game-review-service";

vi.mock("@/runtime/world/shards", () => ({ requireOpenShard: vi.fn() }));
vi.mock("@/services/leaderboard/landing-leaderboard-service", () => ({
  buildLandingLeaderboard: vi.fn(),
  normalizeLeaderboardAddress: vi.fn(),
}));

it("reconstructs review tiles from terrain keys and canonical occupancy, including unrevealed tiles", () => {
  const key = { game_id: 1, alt: true, col: 12, row: 34 };
  const result = buildMapSnapshot({
    game_id: "1",
    confirmed_block: 10,
    models: [
      { model: "TileOpt", rows: [{ key: "0x1", value: { ...key, data: String(5n << 41n) } }] },
      {
        model: "TileOccupancy",
        rows: [
          { key: "0x2", value: { ...key, entity_id: 7, category: 15, is_structure: false } },
          { key: "0x3", value: { ...key, col: 13, entity_id: 0, category: 39, is_structure: true } },
        ],
      },
    ],
  });
  expect(result).toMatchObject({
    available: true,
    totalTiles: 2,
    tiles: [
      { alt: true, col: 12, row: 34, biome: 5, hasOccupier: true, occupierType: 15, occupierIsStructure: false },
      { alt: true, col: 13, row: 34, biome: 0, hasOccupier: true, occupierType: 39, occupierIsStructure: true },
    ],
  });
});
