import { describe, expect, it } from "vitest";

import { buildGameDirectory } from "./game-directory";
import type { FoldRow } from "./types";

const row = (key: string, value: Record<string, unknown>): FoldRow => ({ key, value });

const registry = {
  game_id: "0x3a",
  name: "0x68756d616e2d676174652d33",
  preset_id: "0x1",
  status: "Live",
  dev_mode_on: true,
  start_settling_at: "0x64",
  start_main_at: "0xc8",
  end_at: "0x12c",
  end_grace_seconds: "0x3c",
  registration_grace_seconds: "0x78",
};

const worldConfig = {
  game_id: "0x3a",
  map_center_offset: "0x10",
  blitz_mode_on: true,
  blitz_registration_config: {
    registration_count: "0x9",
    registration_count_max: "0x60",
    registration_start_at: "0x63",
  },
  blitz_settlement_config: {
    base_distance: "0x8",
    single_realm_mode: false,
    two_player_mode: false,
  },
  settlement_config: {
    base_distance: "0x8",
    layer_max: "0x6",
    layers_skipped: "0x2",
    spires_layer_distance: "0x3",
    spires_max_count: "0x4",
    spires_settled_count: "0x1",
  },
};

const models = new Map<string, FoldRow[]>([
  ["GameRegistry", [row("0x1", registry)]],
  ["WorldConfig", [row("0x2", worldConfig)]],
  ["BlitzSettlement", [row("0x8", { game_id: "0x3a", player: "0xabc" })]],
  [
    "Structure",
    [
      row("0x3", { game_id: "0x3a", base: { category: "0x1" }, owner: "0xabc" }),
      row("0x4", { game_id: "0x3a", base: { category: "0x5" }, owner: "0xdef" }),
      row("0x5", { game_id: "0x3a", base: { category: "0x1" }, owner: "0xabc" }),
      row("0x6", { game_id: "0x3a", base: { category: "0x3" }, owner: "0xdef" }),
    ],
  ],
]);

describe("Herald game directory", () => {
  it("normalizes registry clocks, configuration, and settlement counts", () => {
    const directory = buildGameDirectory({
      chain: "madara",
      confirmedBlock: 136_924,
      fold: { modelRows: (model) => models.get(model) ?? [] },
    });

    expect(directory).toEqual({
      chain: "madara",
      confirmed_block: 136_924,
      games: [
        expect.objectContaining({
          clock: {
            end_at: 300,
            end_grace_seconds: 60,
            registration_grace_seconds: 120,
            start_main_at: 200,
            start_settling_at: 100,
          },
          game_id: 58,
          mode: "blitz",
          name: "human-gate-3",
          player_count: 2,
          registration: { count: 9, max: 96, start_at: 99 },
          settled_realms_count: 2,
          settled_villages_count: 1,
          status: "Live",
        }),
      ],
    });
  });

  it("joins one requested player's registration and settlement state into the directory", () => {
    const directory = buildGameDirectory({
      chain: "madara",
      confirmedBlock: 136_924,
      fold: { modelRows: (model) => models.get(model) ?? [] },
      playerAddress: "0xabc",
    });

    expect(directory.games[0]?.player_state).toEqual({ registered: true, settled: true });
  });

  it("does not treat village ownership as an Eternum realm settlement", () => {
    const directory = buildGameDirectory({
      chain: "madara",
      confirmedBlock: 136_924,
      fold: { modelRows: (model) => models.get(model) ?? [] },
      playerAddress: "0xdef",
    });

    expect(directory.games[0]?.player_state).toEqual({ registered: false, settled: false });
  });
});
