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
import { usePick } from "./pick-moment";

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
const progress = (explorerId: number, pending: Record<string, unknown> | null, level = 1) => ({
  game_id: 1,
  explorer_id: explorerId,
  level,
  xp: 0,
  battle: 1,
  logistics: 1,
  scouting: 1,
  support: 1,
  pending,
});
const levelOffer = (id: number) => ({ id, source: "Level", amount: 1, choices: ["Battle", "Scouting", "Support"] });
const set = (key: string, model: string, value: Record<string, unknown> | null) => ({ model, key, value });

let pick: ReturnType<typeof usePick> = null;
const Probe = () => {
  pick = usePick();
  return null;
};

describe("the pick in the HUD", () => {
  it("opens on a live level-up, sends ChooseAttribute, lands on its own story and closes with its army", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    useAccountStore.setState({ account: { address: PLAYER } as never });
    const store = new NativeFactStore();
    // An offer already waiting when the game loads is not a level-up: it waits on its chip.
    store.applyFacts([
      set("0x1", "Structure", home),
      set("0x2", "ExplorerTroops", army(201)),
      set("0x3", "ExplorerTroops", army(202)),
      set("0x4", "ArmyProgress", progress(201, null)),
      set("0x5", "ArmyProgress", progress(202, levelOffer(6), 2)),
      set("0x6", "ArmyProgressionRules", { game_id: 1, reveal_xp: 10, clear_xp: 25, level_step_xp: 20 }),
    ] as never);
    const choose = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { choose_attribute: choose } } as unknown as GameClientSetup}
          account={{ address: PLAYER } as never}
        >
          <Probe />
          <FrontierPick />
        </GameProvider>,
      ),
    );
    expect(pick).toBeNull();

    act(() => store.applyFacts([set("0x4", "ArmyProgress", progress(201, levelOffer(7), 2))] as never));
    expect(pick?.explorerId).toBe(201);
    expect(host.querySelector('[aria-label="Choose an attribute"]')).not.toBeNull();

    const button = (label: string) =>
      [...host.querySelectorAll("button")].find((candidate) =>
        (candidate.getAttribute("aria-label") ?? candidate.textContent ?? "").startsWith(label),
      )!;
    act(() => button("Battle").click());
    await act(async () => button("Choose").click());
    expect(choose).toHaveBeenCalledWith(expect.objectContaining({ explorerId: 201, offerId: 7, attribute: "Battle" }));

    act(() =>
      store.applyEvent({
        model: "StoryEvent",
        key: "0x9",
        value: {
          game_id: 1,
          order: "5",
          index: 0,
          timestamp: 100,
          story: {
            AttributeChosen: {
              explorer_id: 201,
              offer_id: 7,
              source: "Level",
              attribute: "Battle",
              applied: 1,
              lost: 0,
            },
          },
        },
      }),
    );
    expect(pick?.phase).toBe("chosen");

    // A second offer is the chip's to open; an army that leaves takes an open pick with it.
    act(() => store.applyFacts([set("0x4", "ArmyProgress", progress(201, levelOffer(8), 3))] as never));
    act(() => store.applyFacts([set("0x2", "ExplorerTroops", null), set("0x4", "ArmyProgress", null)] as never));
    expect(pick).toBeNull();
    act(() => root.unmount());
    host.remove();
  });
});
