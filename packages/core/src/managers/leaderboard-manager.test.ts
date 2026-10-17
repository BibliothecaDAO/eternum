import { afterEach, describe, expect, it } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "./config-manager";
import { LeaderboardManager } from "./leaderboard-manager";
import { setBlockTimestampSource } from "../utils/timestamp";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { hash } from "starknet";

const PLAYER = 0x3e1a40b7n;
const upsert = (store: NativeFactStore, keys: number[], model: string, value: Record<string, unknown>) =>
  store.applyFacts([{ model, key: hash.computePoseidonHashOnElements(keys), value }]);
const points = (store: NativeFactStore, game: number, amount: bigint) =>
  upsert(store, [game, Number(PLAYER)], "PlayerPoints", {
    game_id: game,
    address: PLAYER,
    points: amount * 1_000_000n,
  });

afterEach(() => setBlockTimestampSource(null));
describe("native leaderboard", () => {
  it("scopes registered points and rankings by game", () => {
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 23, complete: true, actor: PLAYER.toString(), timestamp: 350 });
    points(store, 23, 17332n);
    points(store, 15, 5275n);
    const manager = new LeaderboardManager(store);
    configManager.setActiveGame(23, 1);
    expect(manager.getPlayerRegisteredPoints(PLAYER)).toBe(17332);
    expect(manager.playersByRank).toEqual([[PLAYER, 17332]]);
    configManager.setActiveGame(15, 1);
    expect(manager.getPlayerRegisteredPoints(PLAYER)).toBe(5275);
    expect(() => configManager.setActiveGame(0, 1)).toThrow("positive game");
  });

  it("rebinds the singleton to the current store without keeping standings from a previous world", () => {
    configManager.setActiveGame(23, 1);
    const first = new NativeFactStore();
    const second = new NativeFactStore();
    points(first, 23, 10n);
    points(second, 23, 20n);
    expect(LeaderboardManager.instance(first).pointsPerPlayer.get(PLAYER)).toBe(10);
    expect(LeaderboardManager.instance(second).pointsPerPlayer.get(PLAYER)).toBe(20);
  });

  it("replaces elapsed shares with registered points in one transaction and caps accrual at game end", () => {
    configManager.setActiveGame(23, 1);
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 23, complete: true, actor: PLAYER.toString(), timestamp: 350 });
    upsert(store, [23], "SliceRules", {
      ...preset.rules,
      game_id: 23,
      victory_points_grant_config: { ...preset.rules.victory_points_grant_config, hyp_points_per_second: 1000000 },
    });
    upsert(store, [23], "GameRegistry", {
      game_id: 23,
      preset_id: 3,
      name: 1n,

      start_settling_at: 1n,
      start_main_at: 1n,
      end_at: 200n,
      settled: false,
      ready: true,
      dev_mode_on: false,
      end_grace_seconds: 0,
      seed: 1n,
    });
    configManager.setStore(store);
    const shares = {
      game_id: 23,
      entity_id: 7,
      start_at: 100n,
      multiplier: 2,
      shareholders: [{ player: PLAYER, bps: 10000 }],
    };
    upsert(store, [23, 7], "HyperstructureShares", shares);
    setBlockTimestampSource(() => 150);
    const manager = new LeaderboardManager(store);
    expect(manager.pointsPerPlayer.get(PLAYER)).toBe(100);
    const observed: number[] = [];
    store.subscribe(() => observed.push(manager.pointsPerPlayer.get(PLAYER)!));
    store.applyFacts([
      {
        model: "HyperstructureShares",
        key: hash.computePoseidonHashOnElements([23, 7]),
        value: { ...shares, start_at: 150n },
      },
      {
        model: "PlayerPoints",
        key: hash.computePoseidonHashOnElements([23, Number(PLAYER)]),
        value: { game_id: 23, address: PLAYER, points: 100000000n },
      },
    ]);
    expect(observed).toEqual([100]);
    expect(manager.getPlayerHyperstructureUnregisteredShareholderPoints(PLAYER)).toBe(0);
    setBlockTimestampSource(() => 250);
    expect(manager.pointsPerPlayer.get(PLAYER)).toBe(200);
    expect(manager.getCurrentCoOwners(7)).toEqual({
      coOwners: [{ address: PLAYER, percentage: 10000 }],
      timestamp: 150,
    });
    expect(manager.getPlayerShares(PLAYER, 7)).toBe(1);
  });
  it("keeps an unseen Frontier player's score unknown and gives zero to in-scope owners", () => {
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 23, complete: true, actor: PLAYER.toString(), timestamp: 250 });
    upsert(store, [23], "SliceRules", { ...preset.rules, game_id: 23, day_unit_seconds: 100 });
    upsert(store, [23], "SettlementRules", {
      game_id: 23,
      registration_start: 1,
      registration_limit: 2,
      spacing: 10,
      mode: "Single",
    });
    upsert(store, [23], "GameRegistry", {
      game_id: 23,
      preset_id: 3,
      name: 1n,

      start_settling_at: 1n,
      start_main_at: 100n,
      end_at: 1000n,
      settled: false,
      ready: true,
      dev_mode_on: false,
      end_grace_seconds: 0,
      seed: 1n,
    });
    configManager.setActiveGame(23, 3);
    const manager = new LeaderboardManager(store);
    expect(manager.getPlayerRegisteredPoints(PLAYER)).toBe(0);
    expect(manager.getPlayerRegisteredPoints(0x222n)).toBeNull();
    upsert(store, [23, PLAYER], "PlayerPoints", { game_id: 23, address: PLAYER, points: 1_000_000n });
    upsert(store, [23, 0x222], "GuildMember", { game_id: 23, actor: 0x222n, guild_id: 0x333n });
    expect(manager.playersByRank).toEqual([]);
    expect(manager.guildsByRank).toEqual([]);
    expect(manager.pointsPerGuild.size).toBe(0);
    upsert(store, [23, 0x222], "PlayerEntry", { game_id: 23, owner: 0x222n, player: PLAYER });
    expect(manager.getPlayerRegisteredPoints(0x222n)).toBe(0);
  });

  describe("the hyperstructures paying a player now", () => {
    const OTHER = 0x222n;
    /** A game at t=150 whose hyperstructure 7 pays 1 VP a second times its multiplier, shared as given. */
    const world = (options: {
      shareholders: { player: bigint; bps: number }[];
      multiplier?: number;
      grant?: number;
      startAt?: bigint;
      endAt?: bigint;
      devMode?: boolean;
      now?: number;
    }) => {
      configManager.setActiveGame(23, 1);
      const store = new NativeFactStore();
      store.setSnapshot({ gameId: 23, complete: true, actor: PLAYER.toString(), timestamp: 150 });
      upsert(store, [23], "SliceRules", {
        ...preset.rules,
        game_id: 23,
        victory_points_grant_config: {
          ...preset.rules.victory_points_grant_config,
          hyp_points_per_second: options.grant ?? 1_000_000,
        },
      });
      upsert(store, [23], "GameRegistry", {
        game_id: 23,
        preset_id: 3,
        name: 1n,
        start_settling_at: 1n,
        start_main_at: 1n,
        end_at: options.endAt ?? 1_000n,
        settled: false,
        ready: true,
        dev_mode_on: options.devMode ?? false,
        end_grace_seconds: 0,
        seed: 1n,
      });
      upsert(store, [23, 7], "HyperstructureShares", {
        game_id: 23,
        entity_id: 7,
        start_at: options.startAt ?? 100n,
        multiplier: options.multiplier ?? 2,
        shareholders: options.shareholders,
      });
      configManager.setStore(store);
      setBlockTimestampSource(() => options.now ?? 150);
      return new LeaderboardManager(store);
    };
    const quarter = [
      { player: PLAYER, bps: 2_500 },
      { player: OTHER, bps: 7_500 },
    ];

    it("pays a share of the hyperstructure's rate: a quarter of 1 VP a second times 2 is 0.5 VP a second", () => {
      expect(world({ shareholders: quarter }).getPlayerHyperstructuresPaying(PLAYER)).toEqual([
        { hyperstructureId: 7, shareholderPercentage: 0.25, pointsPerSecond: 0.5 },
      ]);
    });

    it("keeps paying right after a checkpoint, when nothing has accrued yet", () => {
      expect(world({ shareholders: quarter, startAt: 150n }).getPlayerHyperstructuresPaying(PLAYER)).toEqual([
        { hyperstructureId: 7, shareholderPercentage: 0.25, pointsPerSecond: 0.5 },
      ]);
    });

    it("is nothing for a player without a share, or for a share that pays nothing", () => {
      expect(world({ shareholders: [{ player: OTHER, bps: 10_000 }] }).getPlayerHyperstructuresPaying(PLAYER)).toEqual(
        [],
      );
      expect(world({ shareholders: quarter, multiplier: 0 }).getPlayerHyperstructuresPaying(PLAYER)).toEqual([]);
      expect(world({ shareholders: quarter, grant: 0 }).getPlayerHyperstructuresPaying(PLAYER)).toEqual([]);
    });

    it("is nothing once the game has ended, except in development mode", () => {
      expect(world({ shareholders: quarter, endAt: 120n }).getPlayerHyperstructuresPaying(PLAYER)).toEqual([]);
      expect(
        world({ shareholders: quarter, endAt: 120n, devMode: true }).getPlayerHyperstructuresPaying(PLAYER),
      ).toEqual([{ hyperstructureId: 7, shareholderPercentage: 0.25, pointsPerSecond: 0.5 }]);
    });
  });
});
