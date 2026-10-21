// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { PlayerInfo } from "@bibliothecadao/types";
import { hash } from "starknet";

import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import type { PlayerActivityBreakdown } from "@/services/leaderboard/player-activity-breakdown-service";

const held = vi.hoisted(() => ({
  store: null as unknown,
  history: undefined as { address: string; activityBreakdown: unknown }[] | undefined,
  effects: { effects: new Map(), rowRefs: { current: new Map() } },
}));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: { store: held.store, systemCalls: { update_whitelist: () => Promise.resolve() } },
    account: { account: { address: "0x52c9ab2a" } },
  }),
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useResolvedWorldGameMode: () => "blitz",
  useGameModeConfig: () => ({ ui: { showGuildsTab: false, showEndSeasonButton: false } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCoarseCurrentDefaultTick: () => 0 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/use-player-profile", () => ({ playerAvatarUrl: () => null }));
vi.mock("./use-leaderboard-effects", () => ({ useLeaderboardEffects: () => held.effects }));
// Herald's history as the panel's reader holds it: the last answer it has, while a newer one may be on its way.
vi.mock("@/hooks/use-leaderboard-activity", () => ({
  useLeaderboardActivity: () => ({ data: held.history, error: null }),
}));
vi.mock("./mmr-forecast", () => ({ useMmrForecast: () => ({ status: "off" }) }));

import { useInGameLeaderboard } from "./use-in-game-leaderboard";
import { PlayersPanel } from "./players-panel";
import { normalizeLeaderboardAddress } from "./finalized-blitz-leaderboard";

const GAME = 4;
const PLAYER = 0x52c9ab2an;
const write = (store: NativeFactStore, keys: number[], model: string, value: Record<string, unknown>) =>
  store.applyFacts([{ model, key: hash.computePoseidonHashOnElements(keys), value }]);

/**
 * The owner's game 4 row as the screenshot shows it: 5,170 points registered by activity (Tiles 670, Crates 750,
 * Camps & Rifts 1,750, HS taken 2,000), two hyperstructures held, and 340 points their shares have earned since the
 * last checkpoint, which no activity has registered yet.
 */
const ownersGame = () => {
  configManager.setActiveGame(GAME, 1);
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: GAME, complete: true, actor: PLAYER.toString(), timestamp: 270 });
  write(store, [GAME], "SliceRules", {
    ...preset.rules,
    game_id: GAME,
    victory_points_grant_config: { ...preset.rules.victory_points_grant_config, hyp_points_per_second: 1_000_000 },
  });
  write(store, [GAME], "GameRegistry", {
    game_id: GAME,
    preset_id: 3,
    name: 1n,
    start_settling_at: 1n,
    start_main_at: 1n,
    end_at: 100_000n,
    settled: false,
    ready: true,
    dev_mode_on: false,
    end_grace_seconds: 0,
    seed: 1n,
  });
  configManager.setStore(store);
  write(store, [GAME, Number(PLAYER)], "PlayerPoints", {
    game_id: GAME,
    address: PLAYER,
    points: 5_170n * 1_000_000n,
  });
  // Two realms settled around it, held whole since second 100: 170 seconds at 2 points a second by the clock below.
  write(store, [GAME, 7], "HyperstructureShares", {
    game_id: GAME,
    entity_id: 7,
    start_at: 100n,
    multiplier: 2,
    shareholders: [{ player: PLAYER, bps: 10_000 }],
  });
  setBlockTimestampSource(() => 270);
  return store;
};

afterEach(() => setBlockTimestampSource(null));

const readStanding = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let standing: ReturnType<typeof useInGameLeaderboard>["standingsByAddress"] extends ReadonlyMap<string, infer S>
    ? S | undefined
    : never;
  const Read = () => {
    standing = useInGameLeaderboard().standingsByAddress.get(normalizeLeaderboardAddress(PLAYER));
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Read />));
  await act(async () => root.unmount());
  return standing;
};

describe("the live standing", () => {
  it("gives the hold points its total counts that no activity has registered yet", async () => {
    held.store = ownersGame();
    expect(await readStanding()).toMatchObject({ points: 5_510, registeredPoints: 5_170, accruingHoldPoints: 340 });
  });

  it("is one reading of the clock: its total is its registered points plus the hold points it carries", async () => {
    held.store = ownersGame();
    // The clock moves on at every read, as it does between two reads crossing a second (review-hs-held-points-1).
    let second = 270;
    setBlockTimestampSource(() => second++);
    const standing = await readStanding();
    expect(standing!.points - standing!.accruingHoldPoints).toBe(5_170);
    expect(standing!.accruingHoldPoints).toBeGreaterThanOrEqual(340);
  });
});

/** The owner's row, registered by activity (Herald), with `heldRegistered` hold points registered at checkpoints. */
const ownersHistory = (heldRegistered: number): PlayerActivityBreakdown => ({
  exploration: { count: 134, points: 670 },
  openRelicChest: { count: 3, points: 750 },
  otherStructureBanditsDefeat: { count: 7, points: 1_750 },
  hyperStructureBanditsDefeat: { count: 2, points: 2_000 },
  hyperstructureShare: { count: heldRegistered > 0 ? 1 : 0, points: heldRegistered },
});

const djizus: PlayerInfo = {
  entity: "0x1",
  address: PLAYER,
  name: "djizus",
  points: 0,
  rank: 1,
  realms: 1,
  mines: 0,
  hyperstructures: 2,
  villages: 0,
  banks: 0,
  isAlive: true,
  guildName: "",
};

/** The owner's row as the real Players panel draws it: its five activity cells and its Points. */
const ownersRow = async (players: PlayerInfo[] = [djizus]) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<PlayersPanel players={players} viewPlayerInfo={() => {}} />));
  const rows = [...host.querySelectorAll("[data-player-address]")].map((row) => {
    const cells = [...row.querySelectorAll("div")]
      .filter((cell) => cell.children.length === 0)
      .map((cell) => cell.textContent ?? "");
    return { address: row.getAttribute("data-player-address"), cells, text: row.textContent ?? "" };
  });
  await act(async () => root.unmount());
  return rows;
};
const columnsSum = (cells: string[]) =>
  cells
    .map((cell) => /· ([\d,]+) points$/.exec(cell)?.[1])
    .filter((points): points is string => points !== undefined)
    .reduce((sum, points) => sum + Number(points.replace(/,/g, "")), 0);

/** A checkpoint (a capture or a share allocation) registers the 340 hold points and starts the allocation again. */
const checkpoint = (store: NativeFactStore) => {
  write(store, [GAME, Number(PLAYER)], "PlayerPoints", { game_id: GAME, address: PLAYER, points: 5_510n * 1_000_000n });
  write(store, [GAME, 7], "HyperstructureShares", {
    game_id: GAME,
    entity_id: 7,
    start_at: 270n,
    multiplier: 2,
    shareholders: [{ player: PLAYER, bps: 10_000 }],
  });
};

describe("the owner's row across a checkpoint, as Herald's history catches up (review-hs-held-points-1)", () => {
  it("before: HS held is the count and the points holding earned, and the columns add up to Points", async () => {
    held.store = ownersGame();
    held.history = [{ address: PLAYER.toString(), activityBreakdown: ownersHistory(0) }];
    const [row] = await ownersRow();
    expect(row.cells).toEqual(
      expect.arrayContaining(["134 · 670 points", "3 · 750 points", "7 · 1,750 points", "2 · 2,000 points"]),
    );
    expect(row.cells).toContain("2 · 340 points");
    expect(row.text).toContain("5,510");
    expect(columnsSum(row.cells)).toBe(5_510);
  });

  it("while history is behind the checkpoint: Points stays 5,510 and no column shows an older breakdown", async () => {
    const store = ownersGame();
    checkpoint(store);
    held.store = store;
    held.history = [{ address: PLAYER.toString(), activityBreakdown: ownersHistory(0) }];
    const [row] = await ownersRow();
    expect(row.text).toContain("5,510");
    expect(columnsSum(row.cells)).toBe(0);
    expect(row.cells.filter((cell) => cell === "…")).toHaveLength(5);
  });

  it("once history has the checkpoint: HS held carries the registered 340, and the columns add up to Points", async () => {
    const store = ownersGame();
    checkpoint(store);
    held.store = store;
    held.history = [{ address: PLAYER.toString(), activityBreakdown: ownersHistory(340) }];
    const [row] = await ownersRow();
    expect(row.cells).toContain("2 · 340 points");
    expect(row.text).toContain("5,510");
    expect(columnsSum(row.cells)).toBe(5_510);
  });

  it("before history answers, every activity cell says it is on its way", async () => {
    held.store = ownersGame();
    held.history = undefined;
    const [row] = await ownersRow();
    expect(row.text).toContain("5,510");
    expect(row.cells.filter((cell) => cell === "…")).toHaveLength(5);
  });

  it("a player history has no entry for has registered nothing: dashes, not a wait", async () => {
    const store = ownersGame();
    const NEWCOMER = 0x77n;
    write(store, [GAME, Number(NEWCOMER)], "PlayerPoints", { game_id: GAME, address: NEWCOMER, points: 0n });
    held.store = store;
    held.history = [{ address: PLAYER.toString(), activityBreakdown: ownersHistory(0) }];
    const rows = await ownersRow([djizus, { ...djizus, address: NEWCOMER, name: "newcomer", hyperstructures: 0 }]);
    const newcomer = rows.find((row) => row.address === String(NEWCOMER))!;
    expect(newcomer.cells.filter((cell) => cell === "—")).toHaveLength(5);
    expect(newcomer.cells).not.toContain("…");
  });
});
