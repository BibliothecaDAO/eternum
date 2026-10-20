// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { hash } from "starknet";

import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import type { VictoryPointGrants } from "@/ui/shared/lib/victory-point-grants";

const held = vi.hoisted(() => ({ store: null as unknown }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: held.store } }) }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useResolvedWorldGameMode: () => "blitz",
  useGameModeConfig: () => ({ ui: { showGuildsTab: false } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCoarseCurrentDefaultTick: () => 0 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/use-player-profile", () => ({ playerAvatarUrl: () => null }));
vi.mock("./use-leaderboard-effects", () => ({
  useLeaderboardEffects: () => ({ effects: new Map(), rowRefs: { current: new Map() } }),
}));

import { useInGameLeaderboard } from "./use-in-game-leaderboard";
import { PlayerList, type PlayerCustom } from "./player-list";
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

describe("HS held shows what holding earned (owner, game 4)", () => {
  it("gives the live standing the hold points its total counts that no activity has registered yet", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    held.store = ownersGame();
    let standing: ReturnType<typeof useInGameLeaderboard>["standingsByAddress"] extends ReadonlyMap<string, infer S>
      ? S | undefined
      : never;
    const Read = () => {
      standing = useInGameLeaderboard().standingsByAddress.get(normalizeLeaderboardAddress(PLAYER));
      return null;
    };
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Read />));
    expect(standing).toMatchObject({ points: 5_510, accruingHoldPoints: 340 });
    await act(async () => root.unmount());
  });

  it("writes the held count with the points holding earned, and the row's columns add up to its Points", () => {
    const grants: VictoryPointGrants = {
      exploreTile: 5,
      openRelicCrate: 250,
      claimCampFromBandits: 250,
      claimHyperstructureFromBandits: 1_000,
      hyperstructurePerSecond: 1,
      hyperstructureScale: "per-realm",
    };
    const djizus: PlayerCustom = {
      entity: "0x1",
      address: PLAYER,
      name: "djizus",
      points: 5_510,
      rank: 1,
      realms: 1,
      mines: 0,
      hyperstructures: 2,
      villages: 0,
      banks: 0,
      isAlive: true,
      guildName: "",
      isUser: true,
      isInvited: false,
      guild: undefined,
      activityBreakdown: {
        exploration: { count: 134, points: 670 },
        openRelicChest: { count: 3, points: 750 },
        otherStructureBanditsDefeat: { count: 7, points: 1_750 },
        hyperStructureBanditsDefeat: { count: 2, points: 2_000 },
        hyperstructureShare: { count: 0, points: 0 },
      },
      accruingHoldPoints: 340,
      mmrDelta: null,
    };
    const html = renderToStaticMarkup(
      <PlayerList
        players={[djizus]}
        grants={grants}
        mmr="off"
        viewPlayerInfo={() => {}}
        whitelistPlayer={() => {}}
        isLoading={false}
      />,
    );
    const cells = [...html.matchAll(/>([^<]+)</g)].map(([, text]) => text.trim()).filter(Boolean);
    expect(cells).toEqual(
      expect.arrayContaining([
        "134 · 670 points",
        "3 · 750 points",
        "7 · 1,750 points",
        "2 · 2,000 points",
        "2 · 340 points",
        "5,510",
      ]),
    );
    const columnPoints = cells
      .map((cell) => /· ([\d,]+) points$/.exec(cell)?.[1])
      .filter((points): points is string => points !== undefined)
      .reduce((sum, points) => sum + Number(points.replace(/,/g, "")), 0);
    expect(columnPoints).toBe(5_510);
  });
});
