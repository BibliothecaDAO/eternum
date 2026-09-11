import { expect, it } from "vitest";
import { buildLiveLeaderboard } from "./live-leaderboard";
import { createEmptyActivityBreakdown } from "@bibliothecadao/eternum/game-sync";
import type { FoldRow } from "./types";

it("uses registered plus elapsed shares, independent of story totals and other games", () => {
  const models: Record<string, Record<string, unknown>[]> = {
    GameRegistry: [{ game_id: 1, preset_id: 1, end_at: 200 }],
    PresetConfig: [{ preset_id: 1, victory_points_grant_config: { hyp_points_per_second: 1_000_000 } }],
    Hyperstructure: [{ game_id: 1, hyperstructure_id: 7, points_multiplier: 2 }],
    HyperstructureShareholders: [
      {
        game_id: 1,
        hyperstructure_id: 7,
        start_at: 100,
        shareholders: [
          ["0xa", 5000],
          ["0xb", 5000],
        ],
      },
    ],
    PlayerRegisteredPoints: [
      { game_id: 1, address: "0xa", registered_points: 5_000_000 },
      { game_id: 2, address: "0xa", registered_points: 999_000_000 },
    ],
  };
  const rows = (model: string): FoldRow[] =>
    (models[model] ?? []).map((value) => ({ key: "0x1", value: value as FoldRow["value"] }));
  const activityBreakdown = createEmptyActivityBreakdown();
  const history = { game_id: "1", entries: [{ address: "0xa", totalPoints: 999, rank: 1, activityBreakdown }] };
  expect(
    buildLiveLeaderboard(rows, "1", 300, history).entries.map(({ address, totalPoints }) => [address, totalPoints]),
  ).toEqual([
    ["0xa", 105],
    ["0xb", 100],
  ]);
  models.PlayerRegisteredPoints = [];
  expect(buildLiveLeaderboard(rows, "1", 300, null).entries.map((entry) => entry.rank)).toEqual([1, 1]);
});
