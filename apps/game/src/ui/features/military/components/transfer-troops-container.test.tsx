// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useBlockTimestamp: () => ({ currentBlockTimestamp: 350, currentDefaultTick: 3, currentArmiesTick: 3 }),
  useCurrentDefaultTick: () => 3,
  useCurrentArmiesTick: () => 3,
  useCurrentBlockTimestamp: () => 350,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { StructureType } from "@bibliothecadao/types";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { TransferTroopsContainer } from "./transfer-troops-container";
import { TransferDirection } from "./transfer-troops/transfer-direction";

const PRECISION = 1_000_000_000n;
const HYPERSTRUCTURE = 900;
const EXPLORER = 201;
const set = (key: string, model: string, value: Record<string, unknown>) => ({ model, key, value });
const troops = (count: bigint, category = "Knight", tier = "T1") => ({
  ...rowFixture.expected.value.troops,
  category,
  tier,
  count: String(count * PRECISION),
  stamina: { Inline: { amount: "100", settled_at: "360", remainder: 0 } },
});

afterEach(() => setBlockTimestampSource(null));

/**
 * The owner's hyperstructure beside his realm's army of 19,145 T1 knights. Each guard slot holds what `guards` gives
 * it: an empty slot is a stored row with no troops (its stale type left as Crossbowman T2), as the chain leaves it.
 */
const reinforce = (guards: Record<number, ReturnType<typeof troops>> = {}) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = frontierDay();
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  store.applyFacts([
    set("0x900", "Structure", {
      ...realm,
      entity_id: HYPERSTRUCTURE,
      base: { ...realm.base, category: StructureType.Hyperstructure, troop_max_guard_count: 4, level: 0 },
    }),
    ...[0, 1, 2, 3].map((slot) =>
      set(`0x90${slot + 1}`, "Guard", {
        game_id: 1,
        structure_id: HYPERSTRUCTURE,
        slot,
        troops: guards[slot] ?? troops(0n, "Crossbowman", "T2"),
        destroyed_tick: 0,
      }),
    ),
    set("0x74", "ExplorerTroops", { game_id: 1, explorer_id: EXPLORER, owner: 7, troops: troops(19_145n) }),
  ] as never);

  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider
        value={{ store, systemCalls: { explorer_guard_swap: vi.fn() } } as unknown as GameClientSetup}
        account={{ address: "0x111" } as never}
      >
        <TransferTroopsContainer
          selectedEntityId={EXPLORER}
          targetEntityId={HYPERSTRUCTURE}
          selectedHex={{ x: 41, y: 12 }}
          targetHex={{ x: 42, y: 12 }}
          transferDirection={TransferDirection.ExplorerToStructure}
          onTransferComplete={() => {}}
        />
      </GameProvider>,
    ),
  );
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((element) => element.textContent?.includes(label));
  return {
    text: () => host.textContent ?? "",
    transfer: () => button("Transfer Troops"),
    choose: (slotName: string) => act(() => button(slotName)!.click()),
    sendMax: () => act(() => button("Max")!.click()),
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
};

describe("reinforcing a structure from an adjacent army", () => {
  it("sends T1 knights into an empty guard slot, whatever type the slot last held", () => {
    const view = reinforce();
    view.sendMax();
    expect(view.text()).not.toMatch(/mismatch/i);
    expect(view.transfer()?.disabled).toBe(false);
    view.unmount();
  });

  it("sends T1 knights into a slot already holding T1 knights", () => {
    const view = reinforce({ 0: troops(500n), 1: troops(500n), 2: troops(500n), 3: troops(500n) });
    view.sendMax();
    expect(view.text()).not.toMatch(/mismatch/i);
    expect(view.transfer()?.disabled).toBe(false);
    view.unmount();
  });

  it("refuses T1 knights into a slot holding T2 paladins, and names both types", () => {
    const paladins = troops(500n, "Paladin", "T2");
    const view = reinforce({ 0: paladins, 1: paladins, 2: paladins, 3: paladins });
    view.choose("Inner Wall");
    view.sendMax();
    expect(view.text()).toContain("Troop mismatch");
    expect(view.text()).toContain("Tier T1 Knight ≠ Tier T2 Paladin");
    expect(view.transfer()?.disabled).toBe(true);
    view.unmount();
  });
});
