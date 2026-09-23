import { WorldFold } from "../world-fold";
import { describe, expect, it } from "vitest";
import { buildNativeDirectory, buildNativeLeaderboard } from "./read-models";
import { manifest, receipt, rowEvent, rulesEvent, schema, setup } from "./fixtures";

function gameEvent(game = "1", settled = "0", dev = "0", preset = "2") {
  return rowEvent(
    "GameRegistry",
    [game],
    ["0x426c69747a", preset, "0x111", settled, "1", dev, "10", "20", "200", "10", "42"],
  );
}
function world() {
  const state = setup();
  state.native.applyReceipt(
    state.fold,
    receipt([
      gameEvent(),
      gameEvent("2"),
      rulesEvent(),
      rulesEvent("2"),
      rowEvent("SettlementRules", ["1"], ["5", "96", "0", "8"]),
      rowEvent("SettlementRules", ["2"], ["5", "2", "2", "8"]),
      rowEvent("SettlementProgress", ["1"], ["2", "1"]),
      rowEvent("PlayerEntry", ["1", "0xaaa"], ["0x111"]),
      rowEvent("PlayerEntry", ["1", "0xbbb"], ["0x222"]),
      rowEvent("PlayerEntry", ["2", "0xccc"], ["0x333"]),
      rowEvent("BlitzRoster", ["1"], ["2", "0x111", "0x222"]),
    ]),
    10,
    0,
  );
  return state;
}
function structure(id: string, category: string, owner: string) {
  return rowEvent(
    "Structure",
    ["1", id],
    [owner, "0", "0", "0", "0", category, "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
  );
}

describe("native directory and leaderboard", () => {
  it("reads native entries, structures and the clock without mirrored configuration rows", () => {
    const { fold, native } = world();
    native.applyReceipt(
      fold,
      receipt([structure("7", "1", "0x111"), structure("8", "5", "0x111"), structure("9", "3", "0x222")]),
      11,
      0,
    );
    const input = { chain: "madara", confirmedBlock: 11, timestamp: 30, fold, playerAddress: "0x111" };
    const entry = buildNativeDirectory(input).games.find((game) => game.game_id === 1)!;
    expect(entry).toMatchObject({
      name: "Blitz",
      mode: "blitz",
      status: "Live",
      player_count: 1,
      player_state: {
        registered: true,
        settled: true,
        roster_member: true,
        structures: [
          { entity_id: 7, category: 1, realm_id: 0, coord_x: 0, coord_y: 0, resources_packed: "0" },
          { entity_id: 8, category: 5, realm_id: 0, coord_x: 0, coord_y: 0, resources_packed: "0" },
        ],
      },
      roster_count: 2,
      registration: { count: 2, max: 96, start_at: 5 },
      settled_realms_count: 1,
      settled_villages_count: 1,
    });
    expect(buildNativeDirectory({ ...input, timestamp: 19 }).games[1].status).toBe("Registration");
    expect(buildNativeDirectory({ ...input, timestamp: 200 }).games[1].status).toBe("Ended");
    native.applyReceipt(fold, receipt([gameEvent("1", "1")]), 12, 0);
    expect(buildNativeDirectory(input).games[1].status).toBe("Settled");
    expect(fold.gameplayAccounts(1)).toEqual(new Set(["0x111", "0x222"]));
    const models = fold.reviewSnapshot(1, 12).models.map(({ model }) => model);
    for (const name of ["LastBattle", "WorldConfig", "PresetConfig", "BlitzSettlement"])
      expect(models).not.toContain(name);
    expect(models).toContain("ResourceProduction");
    native.applyReceipt(fold, receipt([gameEvent("1", "1", "0", "1")]), 13, 0);
    expect(buildNativeDirectory(input).games.find((game) => game.game_id === 1)?.mode).toBe("frontier");
  });

  it("adds unsettled shares with contract rounding, caps at game end, and never double counts checkpointed points", () => {
    const { fold, native } = world();
    native.applyReceipt(
      fold,
      receipt([
        rowEvent("PlayerPoints", ["1", "0x111"], ["1000000"]),
        rowEvent("PlayerPoints", ["2", "0x111"], ["999000000"]),
        rowEvent("HyperstructureShares", ["1", "7"], ["100", "2", "2", "0x111", "3333", "0x222", "6667"]),
      ]),
      11,
      0,
    );
    const leaderboard = (time: number) => buildNativeLeaderboard((name) => fold.modelRows(name), "1", time, null);
    expect(leaderboard(100).entries.map(({ address, totalPoints }) => [address, totalPoints])).toEqual([
      ["0x111", 1],
      ["0x222", 0],
    ]);
    expect(leaderboard(101).entries.map(({ address, totalPoints }) => [address, totalPoints])).toEqual([
      ["0x111", 1.6666],
      ["0x222", 1.3334],
    ]);
    const ended = leaderboard(200);
    expect(leaderboard(900)).toEqual(ended);
    native.applyReceipt(
      fold,
      receipt([
        rowEvent("PlayerPoints", ["1", "0x111"], ["67660000"]),
        rowEvent("PlayerPoints", ["1", "0x222"], ["133340000"]),
        rowEvent("HyperstructureShares", ["1", "7"], ["200", "2", "2", "0x111", "3333", "0x222", "6667"]),
      ]),
      12,
      0,
    );
    expect(leaderboard(900)).toEqual(ended);
    native.applyReceipt(fold, receipt([gameEvent("1", "0", "1")]), 13, 0);
    expect(leaderboard(201).entries[0].totalPoints).toBe(134.6734);
  });

  it("keeps exact integer rank ordering before display conversion and ignores history score totals", () => {
    const { fold, native } = world();
    const huge = 2n ** 100n;
    native.applyReceipt(
      fold,
      receipt([
        rowEvent("PlayerPoints", ["1", "0x111"], [String(huge)]),
        rowEvent("PlayerPoints", ["1", "0x222"], [String(huge + 1n)]),
        rowEvent("AddressName", ["0x111"], ["0x416c696365"]),
      ]),
      11,
      0,
    );
    const result = buildNativeLeaderboard((name) => fold.modelRows(name), "1", 30, new Map());
    expect(result.entries.map(({ address, rank }) => [address, rank])).toEqual([
      ["0x222", 1],
      ["0x111", 2],
    ]);
    // A chain name is not a player's name; the client resolves identity profiles by address.
    expect(result.entries.every((entry) => !("name" in entry))).toBe(true);
  });

  it("fails loudly for missing native rules instead of publishing guessed scores", () => {
    const { fold, native } = setup();
    native.applyReceipt(fold, receipt([gameEvent()]), 10, 0);
    expect(() => buildNativeDirectory({ chain: "madara", confirmedBlock: 10, timestamp: 30, fold })).toThrow(
      "Missing native SettlementRules",
    );
    expect(() => buildNativeLeaderboard((name) => fold.modelRows(name), "1", 30, null)).toThrow(
      "Missing native SliceRules",
    );
  });
});

it("waits for the complete result before freezing and restores tied standings from a checkpoint", () => {
  const { fold, native, decoder } = world();
  native.applyReceipt(fold, receipt([gameEvent("1", "1")]), 12, 0);
  expect(fold.finalizedGameIds()).not.toContain("1");
  native.applyReceipt(fold, receipt([rowEvent("BlitzResult", ["1"], ["1", "0x111", "9500000", "1", "0", "0"])]), 13, 0);
  expect(fold.finalizedGameIds()).not.toContain("1");
  native.applyReceipt(
    fold,
    receipt([rowEvent("BlitzResult", ["1"], ["2", "0x111", "9500000", "1", "0x222", "9500000", "1", "1", "123"])]),
    14,
    0,
  );
  expect(fold.finalizedGameIds()).toEqual(["1"]);
  const restored = WorldFold.restore(decoder.registry, fold.checkpoint());
  expect(restored.finalizedGameIds()).toEqual(["1"]);
  const result = buildNativeLeaderboard((name) => restored.modelRows(name), "1", 500, null);
  expect(result.entries.map(({ address, rank, totalPoints }) => ({ address, rank, totalPoints }))).toEqual([
    { address: "0x111", rank: 1, totalPoints: 9.5 },
    { address: "0x222", rank: 1, totalPoints: 9.5 },
  ]);
});

it("evicts a finalized game to its directory and standings, the same way live and on replay, and keeps a running season", () => {
  const tileData = (game: string) => {
    const model = schema.models.find(({ name }) => name === "TileOpt")!;
    const layout = schema.domains[model.owners[0]].events.find(({ name }) => name === "RowMemberSet")!;
    return {
      from_address: manifest.world.address,
      keys: [...layout.prefix, "1", model.identity, model.members[0].id!],
      data: ["4", game, "0", "5", "5", "1", "2"],
    };
  };
  const finalized = [
    structure("7", "1", "0x111"),
    rowEvent("TileOpt", ["1", "0", "5", "5"], ["1"]),
    rowEvent("TileOpt", ["2", "0", "5", "5"], ["1"]),
    gameEvent("2", "0", "0", "1"),
    gameEvent("1", "1"),
    rowEvent("BlitzResult", ["1"], ["2", "0x111", "9500000", "1", "0x222", "9000000", "2", "1", "123"]),
  ];
  const readModels = (fold: WorldFold) => ({
    directory: buildNativeDirectory({
      chain: "madara",
      confirmedBlock: 11,
      timestamp: 500,
      fold,
      playerAddress: "0x111",
    }),
    standings: buildNativeLeaderboard((name) => fold.modelRows(name), "1", 500, null),
  });

  const live = world();
  live.native.applyReceipt(live.fold, receipt(finalized), 11, 0);
  const before = readModels(live.fold);
  live.fold.evictFinalizedGames();
  live.native.applyReceipt(live.fold, receipt([tileData("1"), tileData("2")]), 12, 0);
  expect(readModels(live.fold)).toEqual(before);
  expect(live.fold.gameRows("TileOpt", "1")).toEqual([]);
  expect(live.fold.gameRows("TileOpt", "2")[0].value.data).toBe("0x2");
  expect(() => live.fold.snapshot("1", 12)).toThrow("Game 1 is finalized");
  expect(live.fold.snapshot("1", 12, ["GameRegistry", "BlitzResult"]).models).toHaveLength(2);

  const replay = world();
  replay.native.applyReceipt(replay.fold, receipt(finalized), 11, 0);
  replay.native.applyReceipt(replay.fold, receipt([tileData("1"), tileData("2")]), 12, 0);
  replay.fold.evictFinalizedGames();
  expect(replay.fold.checkpoint()).toEqual(live.fold.checkpoint());

  const restored = WorldFold.restore(live.decoder.registry, live.fold.checkpoint());
  live.native.applyReceipt(restored, receipt([tileData("1")]), 13, 0);
  expect(restored.checkpoint()).toEqual(live.fold.checkpoint());
});
