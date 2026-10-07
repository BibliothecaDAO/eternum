import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: () => Promise.resolve(null), stop: () => {} }) },
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { configManager } from "@bibliothecadao/eternum";
import { type GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { beginChestOpening, confirmChestOpening, closeChestMoment, useChestMoment } from "./chest-moment";
import { useChestResults } from "./chest-results";

const PLAYER = "0x111";
const set = (key: string, model: string, value: Record<string, unknown> | null) => ({ model, key, value });
const home = {
  game_id: 1,
  entity_id: 100,
  owner: PLAYER,
  base: {
    category: 1,
    level: 0,
    created_at: "0x1",
    troop_max_guard_count: 0,
    troop_max_explorer_count: 3,
    starting_troops_granted: false,
  },
  resources_packed: "0x0",
  metadata: {
    realm_id: 1,
    village_realm: 0,
    mine_kind: 0,
    deepest_depth: 0,
    has_wonder: false,
    order: 0,
  },
};
const progress = (xp: number) => ({
  game_id: 1,
  explorer_id: 201,
  xp,
  battle: 2,
  logistics: 1,
  scouting: 4,
  scouting_kinds: 0b10_10_10,
  homecoming: 1,
});
const RULES = {
  game_id: 1,
  reveal_xp: 2,
  fixed_xp: 200,
  uncommon_xp: 100,
  rare_xp: 200,
  epic_xp: 400,
  legendary_xp: 800,
};
const chestStory = (index: number, kind: "Relic" | "Token", quality: number) => ({
  model: "StoryEvent",
  key: `0xc${index}`,
  value: {
    game_id: 1,
    order: "9",
    index,
    timestamp: 100,
    story: { ChestReward: { explorer_id: 201, kind, quality, depth: 1, lords_exhausted: false } },
  },
});

const seen: { moment: ReturnType<typeof useChestMoment> } = { moment: null };
const Probe = () => {
  useChestResults();
  const moment = useChestMoment();
  useEffect(() => {
    seen.moment = moment;
  });
  return null;
};

afterEach(() => act(() => closeChestMoment()));

describe("a chest's result", () => {
  it("ends the player's opening at once, with its LORDS or with the fixed XP a relic pays", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    useAccountStore.setState({ account: { address: PLAYER } as never });
    const store = new NativeFactStore();
    store.applyFacts([
      set("0x1", "Structure", home),
      set("0x2", "ExplorerTroops", { ...rowFixture.expected.value, game_id: 1, explorer_id: 201, owner: 100 }),
      set("0x3", "ArmyProgress", progress(0)),
      set("0x6", "ArmyProgressionRules", RULES),
      set("0x4", "ChestRules", {
        game_id: 1,
        relic_probability: 9_000,
        token_cap: 1,
        lords_amounts: { common: "100", uncommon: "400", rare: "1500", epic: "6000" },
        lords_pool: "1000000",
        season_epochs: 70,
      }),
    ] as never);
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
          <Probe />
        </GameProvider>,
      ),
    );

    act(() => beginChestOpening({ x: 10, y: 10 }));
    act(() => store.applyEvent(chestStory(1, "Token", 3)));
    expect(seen.moment?.result).toEqual({ outcome: { kind: "lords", intensity: 3, lords: 6_000 } });
    act(() => closeChestMoment());

    act(() => beginChestOpening({ x: 10, y: 10 }));
    act(() => store.applyEvent(chestStory(2, "Relic", 1)));
    expect(seen.moment?.result).toMatchObject({
      outcome: { kind: "relic", intensity: 1, lordsSpent: false },
      relic: { xp: 200 },
    });
    act(() => root.unmount());
  });
});

it.each(["relic", "missing", "story"] as const)(
  "recovers facts while preserving same-batch stories (%s)",
  async (result) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    useAccountStore.setState({ account: { address: PLAYER } as never });
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 1, actor: PLAYER, complete: true, timestamp: 100 });
    store.applyFacts([
      set("0x1", "Structure", home),
      set("0x2", "ExplorerTroops", { ...rowFixture.expected.value, game_id: 1, explorer_id: 201, owner: 100 }),
      set("0x3", "ArmyProgress", progress(0)),
      set("0x6", "ArmyProgressionRules", RULES),
      set("0x4", "ChestRules", {
        game_id: 1,
        relic_probability: 9000,
        token_cap: 1,
        lords_amounts: { common: "100", uncommon: "400", rare: "1500", epic: "6000" },
        lords_pool: "1000000",
        season_epochs: 70,
      }),
      set("0x5", "TileOccupancy", {
        game_id: 1,
        col: 4,
        row: 5,
        alt: false,
        entity_id: 99,
        category: 34,
        is_structure: false,
      }),
    ] as never);
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
          <Probe />
        </GameProvider>,
      ),
    );
    const opening = { gameId: 1, explorerId: 201, hex: { col: 4, row: 5, alt: false } };
    await act(async () => {
      beginChestOpening({ x: 10, y: 10 }, { opening });
      confirmChestOpening(opening);
    });
    expect(seen.moment?.result).toBeNull();
    await act(async () => {
      store.applyFacts([
        set("0x5", "TileOccupancy", null),
        set("0x3", "ArmyProgress", progress(result === "relic" ? 200 : 0)),
      ] as never);
      if (result === "story") store.applyEvent(chestStory(1, "Token", 3));
    });
    // Without its story a relic's XP cannot be told from any other, so the opening ends unnamed.
    if (result === "story") expect(seen.moment?.result).toMatchObject({ outcome: { kind: "lords", lords: 6000 } });
    else expect(seen.moment).toBeNull();
    act(() => root.unmount());
  },
);
