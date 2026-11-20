import { gameRegistryRow } from "../test-support/game-registry";
import { describe, expect, it } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "./config-manager";
import { LeaderboardManager } from "./leaderboard-manager";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";
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

describe("native leaderboard", () => {
  it("scopes registered points and rankings by game", () => {
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 23, complete: true, actor: PLAYER.toString(), timestamp: 350 });
    points(store, 23, 17332n);
    points(store, 15, 5275n);
    const manager = new LeaderboardManager(store);
    configManager.setActiveGame(23, 1);
    expect(manager.getPlayerPoints(PLAYER)).toBe(17332);
    expect(manager.playersByRank).toEqual([{ address: PLAYER, points: 17332 }]);
    configManager.setActiveGame(15, 1);
    expect(manager.getPlayerPoints(PLAYER)).toBe(5275);
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
    upsert(store, [23], "GameRegistry", gameRegistryRow({ game_id: 23, preset_id: 2 }));
    configManager.setActiveGame(23, 2);
    const manager = new LeaderboardManager(store);
    expect(manager.getPlayerPoints(PLAYER)).toBe(0);
    expect(manager.getPlayerPoints(0x222n)).toBeNull();
    upsert(store, [23, PLAYER], "PlayerPoints", { game_id: 23, address: PLAYER, points: 1_000_000n });
    upsert(store, [23, 0x222], "GuildMember", { game_id: 23, actor: 0x222n, guild_id: 0x333n });
    expect(manager.playersByRank).toEqual([]);
    expect(manager.guildsByRank).toEqual([]);
    expect(manager.pointsPerGuild.size).toBe(0);
    upsert(store, [23, 0x222], "PlayerEntry", { game_id: 23, owner: 0x222n, player: PLAYER });
    expect(manager.getPlayerPoints(0x222n)).toBe(0);
  });
});
