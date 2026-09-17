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
      timestamp: 250,
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
      timestamp: 250,
      fold: { modelRows: (model) => models.get(model) ?? [] },
      playerAddress: "0xabc",
    });

    expect(directory.games[0]?.player_state).toEqual({ registered: true, settled: true });
  });

  it("does not treat village ownership as an Eternum realm settlement", () => {
    const directory = buildGameDirectory({
      chain: "madara",
      confirmedBlock: 136_924,
      timestamp: 250,
      fold: { modelRows: (model) => models.get(model) ?? [] },
      playerAddress: "0xdef",
    });

    expect(directory.games[0]?.player_state).toEqual({ registered: false, settled: false });
  });
});

const directoryStatus = (timestamp: number, overrides: Partial<typeof registry> = {}) =>
  buildGameDirectory({
    chain: "madara",
    confirmedBlock: 42,
    timestamp,
    fold: {
      modelRows: (model) =>
        model === "GameRegistry"
          ? [row("0x1", { ...registry, dev_mode_on: false, status: "Registration", ...overrides })]
          : (models.get(model) ?? []),
    },
  }).games[0].status;

describe("directory phase from the chain clock", () => {
  it.each([
    [199, "Registration"],
    [200, "Live"],
    [299, "Live"],
    [300, "Ended"],
    [360, "Ended"],
  ])("advances an unchanged registry at timestamp %i to %s", (timestamp, status) => {
    expect(directoryStatus(timestamp)).toBe(status);
  });

  it("closes an empty expired registration without a game transaction", () => {
    expect(
      directoryStatus(1789592400, {
        game_id: "0xd",
        start_main_at: "1789588800",
        end_at: "1789592400",
        end_grace_seconds: "86400",
      }),
    ).toBe("Ended");
  });

  it("preserves explicit end and settlement without inventing settlement from time", () => {
    expect(directoryStatus(100, { status: "Ended" })).toBe("Ended");
    expect(directoryStatus(100, { status: "Settled" })).toBe("Settled");
    expect(directoryStatus(999, { status: "Settled" })).toBe("Settled");
    expect(directoryStatus(999)).toBe("Ended");
  });

  it("keeps an open-ended game live and a not-yet-open created game created", () => {
    expect(directoryStatus(999, { end_at: "0x0" })).toBe("Live");
    expect(directoryStatus(100, { status: "Created" })).toBe("Created");
  });

  it("opens development games immediately but respects their scheduled end", () => {
    expect(directoryStatus(100, { dev_mode_on: true })).toBe("Live");
    expect(directoryStatus(300, { dev_mode_on: true })).toBe("Ended");
  });
});
