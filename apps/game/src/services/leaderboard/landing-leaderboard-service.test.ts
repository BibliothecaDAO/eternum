import type { HeraldGameSnapshot } from "@bibliothecadao/eternum/game-sync";
import { describe, expect, it } from "vitest";

import { buildLandingLeaderboard } from "./landing-leaderboard-service";

const snapshot: HeraldGameSnapshot = {
  confirmed_block: 12,
  game_id: "7",
  models: [
    { model: "AddressName", rows: [] },
    {
      model: "PlayerRegisteredPoints",
      rows: [
        {
          key: "0x1",
          value: { address: "0xa", prize_claimed: false, registered_points: "0x5f5e100" },
        },
      ],
    },
    {
      model: "GameRegistry",
      rows: [{ key: "0x2", value: { end_at: "0xc8", game_id: "0x7", preset_id: "0x1" } }],
    },
    {
      model: "PresetConfig",
      rows: [
        {
          key: "0x3",
          value: {
            preset_id: "0x1",
            victory_points_grant_config: { hyp_points_per_second: "0xf4240" },
          },
        },
      ],
    },
    {
      model: "Hyperstructure",
      rows: [
        {
          key: "0x4",
          value: { game_id: "0x7", hyperstructure_id: "0x2a", points_multiplier: "0x2" },
        },
      ],
    },
    {
      model: "HyperstructureShareholders",
      rows: [
        {
          key: "0x5",
          value: {
            game_id: "0x7",
            hyperstructure_id: "0x2a",
            shareholders: [["0xa", "0x1388"]],
            start_at: "0x64",
          },
        },
      ],
    },
  ],
};

describe("buildLandingLeaderboard", () => {
  it("combines registered points with the live shareholder term", () => {
    expect(buildLandingLeaderboard(snapshot, [])).toEqual([
      expect.objectContaining({ address: "0xa", points: 200, registeredPoints: 100, unregisteredPoints: 100 }),
    ]);
  });
});
