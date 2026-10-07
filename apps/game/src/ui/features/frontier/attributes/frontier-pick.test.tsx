import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: () => Promise.resolve(null) }) },
}));
vi.mock("@/ui/motion/motion-settings", () => ({ playHaptic: () => {}, useReducedMotion: () => true }));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { configManager } from "@bibliothecadao/eternum";
import { type GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { FrontierPick } from "./frontier-pick";
import { openPick, usePick } from "./pick-moment";

const PLAYER = "0x111";
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
const army = (explorerId: number) => ({
  ...rowFixture.expected.key,
  ...rowFixture.expected.value,
  game_id: 1,
  explorer_id: explorerId,
  owner: 100,
});
const progress = (explorerId: number, xp: number) => ({
  game_id: 1,
  explorer_id: explorerId,
  xp,
  battle: 1,
  logistics: 1,
  scouting: 1,
  support: 1,
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
const set = (key: string, model: string, value: Record<string, unknown> | null) => ({ model, key, value });

let pick: ReturnType<typeof usePick> = null;
const Probe = () => {
  pick = usePick();
  return null;
};

describe("the Upgrade in the HUD", () => {
  it("opens from its army, sends BuyTier, lands on its own story and closes with its army", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    useAccountStore.setState({ account: { address: PLAYER } as never });
    const store = new NativeFactStore();
    store.applyFacts([
      set("0x1", "Structure", home),
      set("0x2", "ExplorerTroops", army(201)),
      set("0x4", "ArmyProgress", progress(201, 150)),
      set("0x6", "ArmyProgressionRules", RULES),
    ] as never);
    const buy = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { buy_tier: buy } } as unknown as GameClientSetup}
          account={{ address: PLAYER } as never}
        >
          <Probe />
          <FrontierPick />
        </GameProvider>,
      ),
    );
    // Earning XP never opens the panel on its own: the army's chip does.
    expect(pick).toBeNull();
    act(() => openPick(201));
    expect(host.querySelector('[aria-label="Choose an attribute"]')).not.toBeNull();

    const button = (label: string) =>
      [...host.querySelectorAll("button")].find((candidate) =>
        (candidate.getAttribute("aria-label") ?? candidate.textContent ?? "").startsWith(label),
      )!;
    act(() => button("Battle").click());
    await act(async () => button("Choose").click());
    expect(buy).toHaveBeenCalledWith(expect.objectContaining({ explorerId: 201, attribute: "Battle" }));

    act(() =>
      store.applyEvent({
        model: "StoryEvent",
        key: "0x9",
        value: {
          game_id: 1,
          order: "5",
          index: 0,
          timestamp: 100,
          story: { TierBought: { explorer_id: 201, attribute: "Battle", tier: 2, price: 100 } },
        },
      }),
    );
    expect(pick?.phase).toBe("chosen");

    // An army that leaves takes an open panel with it.
    act(() => openPick(201));
    act(() => store.applyFacts([set("0x2", "ExplorerTroops", null), set("0x4", "ArmyProgress", null)] as never));
    expect(pick).toBeNull();
    act(() => root.unmount());
    host.remove();
  });
});
