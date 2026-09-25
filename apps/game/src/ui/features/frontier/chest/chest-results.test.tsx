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
import { beginChestOpening, closeChestMoment, useChestMoment } from "./chest-moment";
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
const progress = (pending: Record<string, unknown> | null) => ({
  game_id: 1,
  explorer_id: 201,
  level: 2,
  xp: 0,
  battle: 2,
  logistics: 1,
  scouting: 4,
  support: 1,
  pending,
});
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
  it("ends the player's opening with its LORDS at once, and a relic once its offer is on the army", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    useAccountStore.setState({ account: { address: PLAYER } as never });
    const store = new NativeFactStore();
    store.applyFacts([
      set("0x1", "Structure", home),
      set("0x2", "ExplorerTroops", { ...rowFixture.expected.value, game_id: 1, explorer_id: 201, owner: 100 }),
      set("0x3", "ArmyProgress", progress(null)),
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
    expect(seen.moment?.result).toBeNull();
    const offer = { id: 5, source: "Relic", amount: 2, choices: ["Battle", "Scouting", "Support"] };
    act(() => store.applyFacts([set("0x3", "ArmyProgress", progress(offer))] as never));
    expect(seen.moment?.result).toMatchObject({
      outcome: { kind: "relic", intensity: 1, lordsSpent: false },
      relic: {
        offer: {
          amount: 2,
          choices: [
            { attribute: "Battle", level: 2 },
            { attribute: "Scouting", level: 4 },
            { attribute: "Support", level: 1 },
          ],
        },
      },
    });
    act(() => root.unmount());
  });
});
