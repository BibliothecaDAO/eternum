import { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../../config/deployer/clean/registrar/native-preset";
import { CairoCustomEnum, CairoOption, CairoOptionVariant } from "starknet";
import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import { createHeraldRequestHandler } from "../http";
import { WorldFold } from "../world-fold";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNativeDirectory, buildNativeLeaderboard, directoryFact } from "./read-models";
import {
  structureValue,
  explorerValue,
  pointsAward,
  manifest,
  seedDerivedRows,
  receipt,
  rowEvent,
  rulesEvent,
  schema,
  setup,
  shardManifest,
} from "./fixtures";

function gameEvent(game = "1", settled = "0", dev = "0", preset = "2", name = "Blitz") {
  return rowEvent("GameRegistry", [game], {
    name: "0x" + Buffer.from(name).toString("hex"),
    preset_id: preset,
    creator: "0x111",
    settled: BigInt(settled) !== 0n,
    ready: true,
    dev_mode_on: BigInt(dev) !== 0n,
    start_settling_at: "10",
    start_main_at: "20",
    end_at: "200",
    end_grace_seconds: "10",
    seed: "42",
  });
}
function world() {
  const state = setup();
  state.native.applyReceipt(
    state.fold,
    receipt(
      seedDerivedRows(state.fold, state.decoder, [
        gameEvent(),
        gameEvent("2"),
        rulesEvent(),
        rulesEvent("2"),
        rowEvent("SettlementRules", ["1"], {
          registration_start: 5n,
          registration_limit: 96n,
          mode: new CairoCustomEnum({ Single: {} }),
          spacing: 8n,
        }),
        rowEvent("SettlementRules", ["2"], {
          registration_start: 5n,
          registration_limit: 2n,
          mode: new CairoCustomEnum({ Duel: {} }),
          spacing: 8n,
        }),
        rowEvent("SettlementProgress", ["1"], { registered: 2n, realm_count: 1n }),
        rowEvent("PlayerEntry", ["1", "0xaaa"], { player: 273n }),
        rowEvent("PlayerEntry", ["1", "0xbbb"], { player: 546n }),
        rowEvent("PlayerEntry", ["2", "0xccc"], { player: 819n }),
        rowEvent("BlitzRoster", ["1"], {
          players: [
            { account: 273n, wallet: 1000n },
            { account: 546n, wallet: 1001n },
          ],
        }),
      ]),
    ),
    10,
    0,
  );
  return state;
}
function structure(id: string, category: string, owner: string, level = "0") {
  return rowEvent("Structure", ["1", id], {
    ...structureValue,
    owner,
    base: { ...structureValue.base, category, level },
  });
}

it("never lists deployment check games or counts them as Frontier seasons", () => {
  const { fold, native } = world();
  const name = BigInt("0x" + Buffer.from("check-frontier-abc").toString("hex"));
  native.applyReceipt(fold, receipt([rowEvent("GameRegistry", ["1"], { ...eventValue(), name })]), 11, 0);
  function eventValue() {
    return {
      name,
      preset_id: 5n,
      settled: false,
      ready: true,
      dev_mode_on: false,
      start_settling_at: 10n,
      start_main_at: 20n,
      end_at: 200n,
      end_grace_seconds: 10n,
      seed: 42n,
    };
  }
  const directory = buildNativeDirectory({ chain: "madara", confirmedBlock: 11, timestamp: 30, fold });
  expect(directory.games.map(({ game_id }) => game_id)).toEqual([2]);
});

describe("native directory and leaderboard", () => {
  it("keeps each player's frozen payout wallet after the game ends and has none for a nonmember", () => {
    const { fold, native } = world();
    native.applyReceipt(fold, receipt([gameEvent("1", "1")]), 12, 0);
    for (const [playerAddress, wallet] of [
      ["0x111", "0x3e8"],
      ["0x222", "0x3e9"],
      ["0x333", null],
    ]) {
      const directory = buildNativeDirectory({
        chain: "madara",
        confirmedBlock: 12,
        timestamp: 201,
        fold,
        playerAddress: playerAddress!,
      });
      const game = directory.games.find(({ game_id }) => game_id === 1)!;
      expect(game.player_state?.roster_wallet).toBe(wallet);
      expect(game.status).toBe("Settled");
    }
  });

  it("reads native entries, structures and the clock without mirrored configuration rows", () => {
    const { fold, native } = world();
    native.applyReceipt(
      fold,
      receipt([
        structure("7", "1", "0x111"),
        structure("8", "5", "0x111"),
        structure("9", "3", "0x222"),
        ...[7, 8, 9].map((id) =>
          rowEvent("TileOccupancy", ["1", "0", String(id), "0"], {
            entity_id: String(id),
            category: "1",
            is_structure: true,
          }),
        ),
      ]),
      11,
      0,
    );
    const input = { chain: "madara", confirmedBlock: 11, timestamp: 30, fold, playerAddress: "0x111" };
    const entry = buildNativeDirectory(input).games.find((game) => game.game_id === 1)!;
    expect(entry).toMatchObject({
      name: "Blitz",
      mode: "blitz",
      expedition: null,
      status: "Live",
      player_count: 1,
      player_state: {
        registered: true,
        settled: true,
        roster_wallet: "0x3e8",
        structures: [
          { entity_id: 7, category: 1, level: 0, realm_id: 0, coord_x: 7, coord_y: 0, resources_packed: "0" },
          { entity_id: 8, category: 5, level: 0, realm_id: 0, coord_x: 8, coord_y: 0, resources_packed: "0" },
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

  it("publishes each expedition's day unit and seed, and null for Blitz", () => {
    const { fold, native, decoder } = world();
    const derived = seedDerivedRows(fold, decoder, [
      gameEvent("1", "0", "0", "101"),
      gameEvent("2", "0", "0", "5"),
      gameEvent("3", "0", "0", "2"),
      rulesEvent("1", "120"),
      rulesEvent("2", "14400"),
      rulesEvent("3", "0"),
      rowEvent("SettlementRules", ["3"], {
        registration_start: 5n,
        registration_limit: 96n,
        mode: new CairoCustomEnum({ Single: {} }),
        spacing: 8n,
      }),
    ]);
    native.applyReceipt(fold, receipt(derived), 12, 0);

    const games = buildNativeDirectory({ chain: "madara", confirmedBlock: 12, timestamp: 30, fold }).games;
    expect(games.find(({ game_id }) => game_id === 1)).toMatchObject({
      preset_id: 101,
      mode: "frontier",
      expedition: { day_unit_seconds: 120, seed: "42" },
    });
    expect(games.find(({ game_id }) => game_id === 2)).toMatchObject({
      preset_id: 5,
      mode: "frontier",
      expedition: { day_unit_seconds: 14400, seed: "42" },
    });
    expect(games.find(({ game_id }) => game_id === 3)).toMatchObject({
      preset_id: 2,
      mode: "blitz",
      expedition: null,
    });
  });

  it("keeps the player's directory and the clear receipt when a Frontier site and its guard are removed", () => {
    const { fold, native, decoder } = world();
    const site = {
      category: 9,
      initial_guard_count: 1_000_000_000_000n,
      alt: false,
      col: 1764,
      row: 50,
      clear: new CairoOption(CairoOptionVariant.None),
    };
    native.applyReceipt(
      fold,
      receipt([
        ...seedDerivedRows(fold, decoder, [gameEvent("1", "0", "0", "101"), rulesEvent("1", "120")]),
        structure("7", "1", "0x111"),
        structure("6", "9", "0x0"),
        rowEvent("ExpeditionSite", ["1", "6"], site),
        rowEvent("Guard", ["1", "6", "0"], {
          troops: explorerValue("6", site.initial_guard_count).troops,
          destroyed_tick: 0,
        }),
        rowEvent("TileOccupancy", ["1", "0", "1764", "50"], { entity_id: "6", category: "42", is_structure: true }),
      ]),
      11,
      0,
    );
    const input = { chain: "madara", confirmedBlock: 12, timestamp: 30, fold, playerAddress: "0x111" };
    const before = buildNativeDirectory(input).games.find(({ game_id }) => game_id === 1)!.player_state;
    const deleted = (model: string, keys: string[]) => ({
      from_address: manifest.world.address,
      keys: [
        ...schema.games.events.find(({ name }) => name === "RowDeleted")!.prefix,
        "1",
        schema.models.find(({ name }) => name === model)!.identity,
      ],
      data: [String(keys.length), ...keys],
    });
    native.applyReceipt(
      fold,
      receipt([
        rowEvent("ExpeditionSite", ["1", "6"], {
          ...site,
          clear: new CairoOption(CairoOptionVariant.Some, {
            explorer_id: 201n,
            home_id: 7n,
            reward: new CairoOption(CairoOptionVariant.Some, { resource_type: 38, amount: 3_000_000_000_000n }),
          }),
        }),
        deleted("TileOccupancy", ["1", "0", "1764", "50"]),
        deleted("Guard", ["1", "6", "0"]),
        deleted("Structure", ["1", "6"]),
      ]),
      12,
      0,
    );
    const after = buildNativeDirectory(input).games.find(({ game_id }) => game_id === 1)!.player_state;
    expect(after).toEqual(before);
    expect(after!.structures.map(({ entity_id }) => entity_id)).toEqual([7]);
    expect(fold.modelRows("Structure").map(({ value }) => value.entity_id)).toEqual(["0x7"]);
    expect(fold.structurePosition("1", "6")).toBeUndefined();
    expect(fold.modelRows("Guard")).toEqual([]);
    const retained = fold.modelRows("ExpeditionSite");
    expect(retained).toHaveLength(1);
    expect(retained[0]!.value).toMatchObject({ category: "0x9", col: "0x6e4", row: "0x32" });
    const restored = WorldFold.restore(decoder.registry, fold.checkpoint());
    expect(restored.modelRows("ExpeditionSite")).toEqual(retained);
    expect(buildNativeDirectory({ ...input, fold: restored })).toEqual(buildNativeDirectory(input));
    native.applyReceipt(fold, receipt([gameEvent("1", "1", "0", "101")]), 13, 0);
    fold.evictFinalizedGames();
    expect(buildNativeDirectory(input).games.find(({ game_id }) => game_id === 1)!.player_state!.structures).toEqual(
      after!.structures,
    );
  });

  it("publishes a structure level-up and invalidates the directory fact", () => {
    const { fold, native } = world();
    native.applyReceipt(
      fold,
      receipt([
        structure("7", "1", "0x111", "1"),
        rowEvent("TileOccupancy", ["1", "0", "7", "0"], {
          entity_id: "7",
          category: "1",
          is_structure: true,
        }),
      ]),
      11,
      0,
    );
    const input = { chain: "madara", confirmedBlock: 11, timestamp: 30, fold, playerAddress: "0x111" };
    const before = buildNativeDirectory(input).games.find(({ game_id }) => game_id === 1)!.player_state!.structures[0]!;
    const beforeFact = directoryFact("Structure", fold.modelRows("Structure")[0]!.value);

    native.applyReceipt(fold, receipt([structure("7", "1", "0x111", "2")]), 12, 0);

    const after = buildNativeDirectory({ ...input, confirmedBlock: 12 }).games.find(({ game_id }) => game_id === 1)!
      .player_state!.structures[0]!;
    const afterFact = directoryFact("Structure", fold.modelRows("Structure")[0]!.value);
    expect(before.level).toBe(1);
    expect(after.level).toBe(2);
    expect(afterFact).not.toEqual(beforeFact);
  });

  it("adds unsettled shares with contract rounding, caps at game end, and never double counts checkpointed points", () => {
    const { fold, native } = world();
    native.applyReceipt(
      fold,
      receipt([
        pointsAward("1", "0x111", "1000000", "1000000", "1000000"),
        pointsAward("2", "0x111", "999000000", "999000000", "999000000"),
        rowEvent("HyperstructureShares", ["1", "7"], {
          start_at: 100n,
          multiplier: 2n,
          shareholders: [
            { player: 273n, bps: 3333n },
            { player: 546n, bps: 6667n },
          ],
        }),
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
        pointsAward("1", "0x111", "66660000", "67660000", "67660000"),
        pointsAward("1", "0x222", "133340000", "133340000", "201000000"),
        rowEvent("HyperstructureShares", ["1", "7"], {
          start_at: 200n,
          multiplier: 2n,
          shareholders: [
            { player: 273n, bps: 3333n },
            { player: 546n, bps: 6667n },
          ],
        }),
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
        pointsAward("1", "0x111", String(huge), String(huge), String(huge)),
        pointsAward("1", "0x222", String(huge + 1n), String(huge + 1n), String(2n * huge + 1n)),
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

  // The old-state dev incident: a clear deleted the site's TileOccupancy and the player took the site.
  // The player's directory still answers; the tile-less site is listed without a position and reported.
  it("answers a player who cleared a Frontier site, through the season's close", () => {
    const { fold, native, decoder } = world();
    native.applyReceipt(
      fold,
      receipt(
        seedDerivedRows(fold, decoder, [
          gameEvent("1", "0", "0", "101"),
          rulesEvent("1", "120", BigInt(nativeRuleConstants.SEASON_CLOSE)),
        ]),
      ),
      11,
      0,
    );
    const RIFT = "9";
    const site = (clear: CairoOption<unknown>) =>
      rowEvent("ExpeditionSite", ["1", "6"], {
        category: RIFT,
        initial_guard_count: 1000n,
        alt: false,
        col: 1764n,
        row: 50n,
        clear,
      });
    const none = () => new CairoOption(CairoOptionVariant.None);
    native.applyReceipt(
      fold,
      receipt([
        structure("1", "1", "0x111"),
        structure("6", RIFT, "0x0"),
        site(none()),
        rowEvent("TileOccupancy", ["1", "0", "1764", "50"], { entity_id: "6", category: RIFT, is_structure: true }),
      ]),
      12,
      0,
    );
    const vacated = {
      from_address: manifest.world.address,
      keys: [
        ...schema.games.events.find(({ name }) => name === "RowDeleted")!.prefix,
        "1",
        schema.models.find(({ name }) => name === "TileOccupancy")!.identity,
      ],
      data: ["4", "1", "0", "1764", "50"],
    };
    native.applyReceipt(
      fold,
      receipt([
        structure("6", RIFT, "0x111"),
        site(new CairoOption(CairoOptionVariant.Some, { explorer_id: 2n, home_id: 1n, reward: none() })),
        vacated,
      ]),
      13,
      0,
    );

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const input = { chain: "madara", confirmedBlock: 13, timestamp: 30, fold, playerAddress: "0x111" };
    const entry = buildNativeDirectory(input).games.find((game) => game.game_id === 1)!;
    expect(entry.player_state?.structures).toContainEqual(
      expect.objectContaining({ entity_id: 6, category: 9, coord_x: null, coord_y: null }),
    );
    expect(entry.player_state?.settled).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({ event: "herald_directory_structure_unplaced", game_id: "1", entity_id: "6", category: 9 }),
    );

    // The season closes and its rows beyond the directory are evicted: the player's directory still answers.
    native.applyReceipt(fold, receipt([gameEvent("1", "1", "0", "101")]), 14, 0);
    expect(fold.finalizedGameIds()).toContain("1");
    fold.evictFinalizedGames();
    const closed = buildNativeDirectory({ ...input, confirmedBlock: 14 }).games.find((game) => game.game_id === 1)!;
    expect(closed.player_state?.settled).toBe(true);
    expect(closed.player_state?.structures).toContainEqual(expect.objectContaining({ entity_id: 6, coord_x: null }));
    warn.mockRestore();
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
  native.applyReceipt(
    fold,
    receipt([
      rowEvent("BlitzResult", ["1"], {
        players: [{ wallet: 1000n, rank: 1n }],
        complete: false,
        commitment: 0n,
      }),
    ]),
    13,
    0,
  );
  expect(fold.finalizedGameIds()).not.toContain("1");
  native.applyReceipt(
    fold,
    receipt([
      pointsAward("1", "0x111", "9500000", "9500000", "9500000"),
      pointsAward("1", "0x222", "9500000", "9500000", "9500000"),
      rowEvent("BlitzResult", ["1"], {
        players: [
          { wallet: 1000n, rank: 1n },
          { wallet: 1001n, rank: 1n },
        ],
        complete: true,
        commitment: 123n,
      }),
    ]),
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

it.each(["Blitz", "check-blitz-abc"])(
  "finalizes and evicts %s identically live and on replay, keeping a running season",
  (name) => {
    const tileData = (game: string) => {
      const model = schema.models.find(({ name }) => name === "TileOpt")!;
      const layout = schema.games.events.find(({ name }) => name === "RowMemberSet")!;
      return {
        from_address: manifest.world.address,
        keys: [...layout.prefix, "1", model.identity, model.members[0].id!],
        data: ["4", game, "0", "5", "5", "1", "2"],
      };
    };
    const finalized = [
      structure("7", "1", "0x111"),
      rowEvent("TileOccupancy", ["1", "0", "7", "0"], { entity_id: 7n, category: 1n, is_structure: true }),
      rowEvent("TileOpt", ["1", "0", "5", "5"], { data: 1n }),
      rowEvent("TileOpt", ["2", "0", "5", "5"], { data: 1n }),
      gameEvent("2", "0", "0", "1"),
      gameEvent("1", "1", "0", "2", name),
      pointsAward("1", "0x111", "9500000", "9500000", "9500000"),
      pointsAward("1", "0x222", "9000000", "9000000", "9000000"),
      rowEvent("BlitzResult", ["1"], {
        players: [
          { wallet: 1000n, rank: 1n },
          { wallet: 1001n, rank: 2n },
        ],
        complete: true,
        commitment: 123n,
      }),
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
    expect(live.fold.finalizedGameIds()).toContain("1");
    if (name.startsWith("check-")) expect(before.directory.games.map(({ game_id }) => game_id)).not.toContain(1);
    expect(live.fold.reviewSnapshot("1", 11).models.some(({ model }) => model === "TileOpt")).toBe(true);
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
  },
);

it("preserves frozen roster wallets through preparation and checkpoint recovery", () => {
  const { native, fold, decoder } = world();
  const input = { chain: "madara", confirmedBlock: 10, timestamp: 15, fold };
  expect(buildNativeDirectory(input).games.find((game) => game.game_id === 1)!.roster).toEqual([
    { account: "0x111", wallet: "0x3e8", prepared: false },
    { account: "0x222", wallet: "0x3e9", prepared: false },
  ]);
  native.applyReceipt(fold, receipt([structure("7", "1", "0x111")]), 11, 0);
  const prepared = buildNativeDirectory(input).games.find((game) => game.game_id === 1)!.roster;
  expect(prepared).toEqual([
    { account: "0x111", wallet: "0x3e8", prepared: true },
    { account: "0x222", wallet: "0x3e9", prepared: false },
  ]);
  const restored = WorldFold.restore(decoder.registry, fold.checkpoint());
  expect(buildNativeDirectory({ ...input, fold: restored }).games.find((game) => game.game_id === 1)!.roster).toEqual(
    prepared,
  );
});

it.each(["Frontier", "check-frontier-abc"])(
  "finalizes %s and keeps custody facts through checkpoint recovery",
  (name) => {
    const state = world();
    const models = ["ChestRules", "LordsBudget", "LordsWithdrawal", "FrontierPrize"];
    const chests = {
      pool_bps: 7000,
      top_n: 10,
      price_ceiling: 50n,
      claim_window_seconds: 604800n,
      shares: { common: 1n, uncommon: 2n, rare: 4n, epic: 10n, legendary: 20n },
    };
    const budget = {
      pool: 1000n,
      pool_left: 900n,
      open: 20n,
      day: 1n,
      price: 25n,
      rolled_shares: 40n,
      yesterday_shares: 80n,
      yesterday_ticks: 12n,
    };
    state.native.applyReceipt(
      state.fold,
      receipt(
        seedDerivedRows(state.fold, state.decoder, [
          rowEvent(
            "SliceRules",
            ["1"],
            buildNativePreset(loadNativePresetConfiguration("madara.frontier", 5), 5).rules,
          ),
          rowEvent("ChestRules", ["1"], chests),
          rowEvent("LordsBudget", ["1"], budget),
          rowEvent("FrontierPrize", ["1"], { pool: 300n, issued: 0n, count: new CairoOption(CairoOptionVariant.None) }),
          rowEvent("LordsWithdrawal", ["1", "85"], { account: 273n, amount: 100n, prize_rank: 0, prize_count: 0 }),
          gameEvent("1", "1", "0", "5", name),
        ]),
      ),
      11,
      0,
    );
    const decodedBudget = state.fold.gameRows("LordsBudget", "1")[0]!.value;
    for (const [field, value] of Object.entries(budget)) expect(BigInt(String(decodedBudget[field]))).toBe(value);
    const before = state.fold.snapshot("1", 11, models).models;
    state.fold.evictFinalizedGames();
    expect(state.fold.finalizedGameIds()).toContain("1");
    expect(state.fold.snapshot("1", 12, models).models).toEqual(before);
    const restored = WorldFold.restore(state.decoder.registry, state.fold.checkpoint());
    expect(restored.snapshot("1", 12, models).models).toEqual(before);
    state.native.applyReceipt(
      restored,
      receipt([
        rowEvent("LordsWithdrawal", ["1", "86"], { account: 273n, amount: 50n, prize_rank: 1, prize_count: 10 }),
      ]),
      12,
      0,
    );
    expect(restored.snapshot("1", 12, ["LordsWithdrawal"]).models[0]!.rows).toHaveLength(2);
  },
);

describe("the player directory over HTTP", () => {
  afterEach(() => vi.restoreAllMocks());
  const handler = (fold: WorldFold) =>
    createHeraldRequestHandler({
      chain: "madara",
      manifest: shardManifest,
      schemas: {},
      worldAddress: manifest.world.address,
      confirmedBlock: () => 13,
      chainTimestamp: () => 30,
      decodedModelCount: 50,
      // The fold's directory reads, as server.ts wires them; the directory reads no snapshot.
      fold: {
        modelRows: (model) => fold.modelRows(model),
        structurePosition: (game, entity) => fold.structurePosition(game, entity),
        directoryRevision: () => fold.directoryRevision(),
        snapshot: () => {
          throw new Error("the directory reads no snapshot");
        },
      },
      undecodableEventCount: () => 0,
      nodeHealth: () => null,
    });
  const RIFT = "9";

  // A structure with no tile keeps its row without a position and is reported; the rest of the player's directory,
  // other structures and other games, still answers.
  it("isolates an owned structure it cannot place and answers the rest", async () => {
    const { fold, native, decoder } = world();
    native.applyReceipt(
      fold,
      receipt(seedDerivedRows(fold, decoder, [gameEvent("1", "0", "0", "101"), rulesEvent("1", "120")])),
      11,
      0,
    );
    native.applyReceipt(
      fold,
      receipt([
        structure("1", "1", "0x111"),
        structure("7", RIFT, "0x111"),
        rowEvent("TileOccupancy", ["1", "0", "1800", "60"], { entity_id: "7", category: RIFT, is_structure: true }),
        structure("8", RIFT, "0x111"),
      ]),
      12,
      0,
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handler(fold)(new Request("http://herald/games?player=0x111"));
    expect(response.status).toBe(200);
    const games = (await response.json()).games as {
      game_id: number;
      player_state: { settled: boolean; structures: unknown[] };
    }[];
    expect(games.map(({ game_id }) => game_id)).toEqual([2, 1]);
    const state = games.find(({ game_id }) => game_id === 1)!.player_state;
    expect(state.settled).toBe(true);
    expect(state.structures).toEqual([
      expect.objectContaining({ entity_id: 1, category: 1 }),
      expect.objectContaining({ entity_id: 7, coord_x: 1800, coord_y: 60 }),
      expect.objectContaining({ entity_id: 8, coord_x: null, coord_y: null }),
    ]);
    expect(warn.mock.calls.map(([line]) => JSON.parse(String(line)))).toContainEqual({
      event: "herald_directory_structure_unplaced",
      game_id: "1",
      entity_id: "8",
      category: 9,
    });
    expect(error).not.toHaveBeenCalled();

    // A malformed player is the caller's error and logs nothing; a broken game is Herald's, logged and a 500.
    expect((await handler(fold)(new Request("http://herald/games?player=nope"))).status).toBe(400);
    expect(error).not.toHaveBeenCalled();
    native.applyReceipt(fold, receipt([gameEvent("3")]), 13, 0);
    const broken = await handler(fold)(new Request("http://herald/games?player=0x111"));
    expect(broken.status).toBe(500);
    expect(error.mock.calls.map(([line]) => JSON.parse(String(line)))).toContainEqual(
      expect.objectContaining({ event: "herald_directory_failed", player: "0x111" }),
    );
  });
});
