import { afterEach, describe, expect, it } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "./config-manager";
import { LeaderboardManager } from "./leaderboard-manager";
import { setBlockTimestampSource } from "../utils/timestamp";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-1.json";
import { hash } from "starknet";

const PLAYER = 0x3e1a40b7n;
const upsert = (store: NativeFactStore, keys: number[], model: string, value: Record<string, unknown>) =>
  store.applyEntityOperations([
    {
      type: "upsert",
      entities: [{ hashed_keys: hash.computePoseidonHashOnElements(keys), models: { [model]: value } }],
    },
  ]);
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
    upsert(store, [23], "SliceRules", {
      ...preset.rules,
      game_id: 23,
      victory_points_grant_config: { ...preset.rules.victory_points_grant_config, hyp_points_per_second: 1000000 },
    });
    upsert(store, [23], "GameRegistry", {
      game_id: 23,
      preset_id: 1,
      name: 1n,
      series_id: 0n,
      game_number_in_series: 0,
      creator: 1n,
      start_settling_at: 1n,
      start_main_at: 1n,
      end_at: 200n,
      settled: false,
      ready: true,
      dev_mode_on: false,
      end_grace_seconds: 0,
      final_trial_id: 0n,
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
    store.applyEntityOperations([
      {
        type: "upsert",
        entities: [
          {
            hashed_keys: hash.computePoseidonHashOnElements([23, 7]),
            models: { HyperstructureShares: { ...shares, start_at: 150n } },
          },
          {
            hashed_keys: hash.computePoseidonHashOnElements([23, Number(PLAYER)]),
            models: { PlayerPoints: { game_id: 23, address: PLAYER, points: 100000000n } },
          },
        ],
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
});
