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
import { configManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { RELICS, StructureType } from "@bibliothecadao/types";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { TransferTroopsContainer } from "./transfer-troops-container";
import { ArmyMergePreview } from "./transfer-troops/army-merge-preview";
import { toast } from "@/ui/features/event-feed/notify";
import { TransferDirection } from "./transfer-troops/transfer-direction";
import { HudWindow } from "@/ui/design-system/kit/hud-elements";

const PRECISION = 1_000_000_000n;
const HYPERSTRUCTURE = 900;
const EXPLORER = 201;
const ARMY = 202;
const set = (key: string, model: string, value: Record<string, unknown>) => ({ model, key, value });
const troops = (count: bigint, category = "Knight", tier = "T1") => ({
  ...rowFixture.expected.value.troops,
  category,
  tier,
  count: String(count * PRECISION),
  stamina: { Inline: { amount: "100", settled_at: "360", remainder: 0 } },
});

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

/**
 * The owner's hyperstructure beside his realm's army of 19,145 T1 knights. Each guard slot holds what `guards` gives
 * it: an empty slot is a stored row with no troops (its stale type left as Crossbowman T2), as the chain leaves it.
 * With `armyBeside`, the transfer goes instead into another of his armies holding those troops.
 */
const reinforce = (
  guards: Record<number, ReturnType<typeof troops>> = {},
  armyBeside?: ReturnType<typeof troops>,
  prepare?: (store: GameClientSetup["store"]) => void,
) => {
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
    ...(armyBeside
      ? [set("0x75", "ExplorerTroops", { game_id: 1, explorer_id: ARMY, owner: 7, troops: armyBeside })]
      : []),
  ] as never);

  prepare?.(store);
  const systemCalls = {
    explorer_guard_swap: vi.fn(),
    explorer_explorer_swap: vi.fn(),
    troop_troop_adjacent_transfer: vi.fn(),
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider
        value={{ store, systemCalls } as unknown as GameClientSetup}
        account={{ address: "0x111" } as never}
      >
        {/* In its window, as the game opens it: the window's foot holds the verb. */}
        <HudWindow title="Transfer Troops & Relics" size="page" onClose={() => {}}>
          <TransferTroopsContainer
            selectedEntityId={EXPLORER}
            targetEntityId={armyBeside ? ARMY : HYPERSTRUCTURE}
            selectedHex={{ x: 41, y: 12 }}
            targetHex={{ x: 42, y: 12 }}
            transferDirection={
              armyBeside ? TransferDirection.ExplorerToExplorer : TransferDirection.ExplorerToStructure
            }
            onTransferComplete={() => {}}
          />
        </HudWindow>
      </GameProvider>,
    ),
  );
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((element) => element.textContent?.includes(label));
  return {
    store,
    systemCalls,
    text: () => host.textContent ?? "",
    /** The form's refusals, said as alerts (a slot's own "Hit first" tag is part of its button, not a message). */
    errors: () =>
      [...host.querySelectorAll('[role="alert"]')]
        .filter((element) => !element.closest("button"))
        .map((element) => element.textContent),
    send: () => [...host.querySelectorAll("button")].at(-1)!,
    transfer: () => button("Transfer Troops"),
    choose: (slotName: string) => act(() => button(slotName)!.click()),
    sendMax: () => act(() => button("Max")!.click()),
    /** The troop count as it reads, after typing `text` into it as a player does. */
    typeCount: (text: string) => {
      const input = host.querySelector<HTMLInputElement>('input[aria-label="Troop count"]')!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      return host.querySelector<HTMLInputElement>('input[aria-label="Troop count"]')!.value;
    },
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
};

describe("reinforcing a structure from an adjacent army", () => {
  it("opens without an error: the closed button says what to choose, until an amount is chosen", () => {
    const view = reinforce();
    expect(view.errors()).toEqual([]);
    expect(view.text()).not.toMatch(/please select/i);
    expect(view.send().textContent).toBe("Choose an amount");
    expect(view.send().disabled).toBe(true);
    view.sendMax();
    expect(view.send().textContent).toBe("Transfer Troops");
    expect(view.send().disabled).toBe(false);
    view.unmount();
  });

  it("keeps the troop count the player typed, as the old count did: its sign and its whole part", () => {
    const view = reinforce();
    expect(view.typeCount("-500")).toBe("0");
    expect(view.typeCount("1.5")).toBe("1");
    expect(view.typeCount("250")).toBe("250");
    expect(view.send().textContent).toBe("Transfer Troops");
    view.unmount();
  });

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

describe("a destination already at its deployment cap", () => {
  /** The most T1 troops one army or guard slot holds, as the game's config sets it. */
  const cap = () => {
    frontierDay();
    return BigInt(configManager.getMaxArmySize(0, "T1" as never));
  };

  it("says calmly that a full guard slot takes no more, before any amount or press", () => {
    const full = troops(cap());
    const view = reinforce({ 0: full, 1: full, 2: full, 3: full });
    expect(view.errors()).toEqual([]);
    expect(view.text()).toContain("Deployment cap reached for guard slot");
    expect(view.send().textContent).toBe("Transfer Troops");
    expect(view.send().disabled).toBe(true);
    view.unmount();
  });

  it("says calmly that a full army takes no more, before any amount or press", () => {
    const view = reinforce({}, troops(cap()));
    expect(view.errors()).toEqual([]);
    expect(view.text()).toContain("Deployment cap reached for destination explorer");
    expect(view.send().textContent).toBe("Transfer Troops");
    expect(view.send().disabled).toBe(true);
    view.unmount();
  });

  it("tells, without an error, that the amount chosen fills the destination", () => {
    const view = reinforce({ 0: troops(cap() - 10n) }, undefined);
    view.choose("Inner Wall");
    view.sendMax();
    expect(view.errors()).toEqual([]);
    expect(view.text()).toContain("will hit its deployment cap");
    expect(view.send().disabled).toBe(false);
    view.unmount();
  });
});

const mergeFacts = (sourceXp: number, targetXp: number) => (store: GameClientSetup["store"]) => {
  store.applyFacts([
    set("0xf1", "ArmyProgressionRules", {
      game_id: 1,
      reveal_xp: 2,
      fixed_xp: 200,
      uncommon_xp: 100,
      rare_xp: 200,
      epic_xp: 400,
      legendary_xp: 800,
    }),
    ...[EXPLORER, ARMY].flatMap((id, slot) => [
      set(slot === 0 ? "0x74" : "0x75", "ExplorerTroops", {
        game_id: 1,
        explorer_id: id,
        owner: 7,
        troops: { ...troops(slot === 0 ? 600n : 500n), stamina: { Slot: slot } },
      }),
      set(`0xf${id}2`, "ArmyProgress", {
        game_id: 1,
        explorer_id: id,
        xp: slot === 0 ? sourceXp : targetXp,
        battle: 1,
        logistics: slot === 0 ? 2 : 1,
        scouting: 1,
        homecoming: 1,
        scouting_kinds: 0,
      }),
      set(slot === 0 ? "0x9" : "0xf2023", "ArmySlot", {
        game_id: 1,
        structure_id: 7,
        epoch: "0",
        slot,
        explorer_id: id,
        stamina: { amount: slot === 0 ? "7" : "100", settled_at: "350", remainder: 0 },
      }),
      set(`0xf${id}4`, "TileOccupancy", {
        game_id: 1,
        entity_id: id,
        col: 41 + slot,
        row: 12,
        alt: false,
        category: 26,
        is_structure: false,
      }),
      set(`0xf${id}5`, "ResourceWeight", { game_id: 1, entity_id: id, capacity: "100000000000000", weight: "0" }),
    ]),
  ] as never);
};

describe("full merge confirmation", () => {
  it.each([
    [0, 99, "Army 1 survives at (41, 12)", 100],
    [0, 101, "Army 2 survives at (42, 12)", 101],
    [0, 100, "Army 2 survives at (42, 12)", 100],
  ])("previews the whole survivor before confirming (%s, %s)", async (sourceXp, targetXp, survivor, value) => {
    const view = reinforce({}, troops(500n), mergeFacts(Number(sourceXp), Number(targetXp)));
    expect(view.text()).not.toContain("survives at");
    view.sendMax();
    expect(view.text()).toContain(survivor);
    expect(view.text()).toContain(`${value} progression value`);
    expect(view.text()).toContain("7 stamina after merging");
    expect(view.text()).toContain("the other army’s XP is lost");
    expect(view.systemCalls.explorer_explorer_swap).not.toHaveBeenCalled();
    await act(async () => view.send().click());
    expect(view.systemCalls.explorer_explorer_swap).toHaveBeenCalledWith(
      expect.objectContaining({ from_explorer_id: EXPLORER, to_explorer_id: ARMY, count: 600 * Number(PRECISION) }),
    );
    view.unmount();
  });
  it("keeps a partial transfer free of a survivor claim", () => {
    const view = reinforce({}, troops(500n), mergeFacts(500, 0));
    view.typeCount("100");
    expect(view.text()).not.toContain("survives at");
    expect(view.send().disabled).toBe(false);
    view.unmount();
  });
});

it("moves the losing army's relics toward the previewed survivor before the troop command", async () => {
  const resourceId = Number(RELICS[0].id);
  const view = reinforce({}, troops(500n), (store) => {
    mergeFacts(500, 0)(store);
    store.applyFacts([
      set("0xf900", "ResourceBalance", {
        game_id: 1,
        entity_id: ARMY,
        resource_type: resourceId,
        balance: String(PRECISION),
      }),
    ] as never);
  });
  view.sendMax();
  expect(view.text()).toContain("Army 1 survives");
  await act(async () => view.send().click());
  expect(view.systemCalls.troop_troop_adjacent_transfer).toHaveBeenCalledWith(
    expect.objectContaining({
      from_troop_id: ARMY,
      to_troop_id: EXPLORER,
      resources: [{ resourceId, amount: Number(PRECISION) }],
    }),
  );
  expect(view.systemCalls.explorer_explorer_swap).toHaveBeenCalledOnce();
  expect(view.systemCalls.troop_troop_adjacent_transfer.mock.invocationCallOrder[0]).toBeLessThan(
    view.systemCalls.explorer_explorer_swap.mock.invocationCallOrder[0],
  );
  view.unmount();
});

it("updates the survivor when authoritative progression changes before confirmation", () => {
  const view = reinforce({}, troops(500n), mergeFacts(0, 99));
  view.sendMax();
  expect(view.text()).toContain("Army 1 survives");
  act(() =>
    view.store.applyFacts([
      set("0xf2022", "ArmyProgress", {
        ...view.store.require("ArmyProgress", { game_id: 1, explorer_id: ARMY }),
        xp: 101,
      }),
    ] as never),
  );
  expect(view.text()).toContain("Army 2 survives");
  expect(view.systemCalls.explorer_explorer_swap).not.toHaveBeenCalled();
  view.unmount();
});

it.each(["0x74", "0x75"])("removes the merge preview when army row %s disappears", (key) => {
  const view = reinforce({}, troops(500n), mergeFacts(500, 0));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store: view.store } as GameClientSetup} account={{ address: "0x111" } as never}>
        <ArmyMergePreview survivorId={EXPLORER} loserId={ARMY} position={{ x: 41, y: 12 }} value={600} />
      </GameProvider>,
    ),
  );
  expect(host.textContent).toContain("Army 1 survives");
  act(() => view.store.applyFacts([{ model: "ExplorerTroops", key, value: null }]));
  expect(host.textContent).toBe("");
  act(() => root.unmount());
  host.remove();
  view.unmount();
});

it.each(["before confirmation", "during relic handoff"])(
  "refuses a changed survivor %s instead of merging with the stale preview",
  async (when) => {
    const failed = vi.spyOn(toast, "failed").mockReturnValue("merge-changed");
    const resourceId = Number(RELICS[0].id);
    const view = reinforce({}, troops(500n), (store) => {
      mergeFacts(500, 0)(store);
      store.applyFacts([
        set("0xf900", "ResourceBalance", {
          game_id: 1,
          entity_id: ARMY,
          resource_type: resourceId,
          balance: String(PRECISION),
        }),
      ] as never);
    });
    const changeWinner = () =>
      view.store.applyFacts([
        set("0xf2022", "ArmyProgress", {
          ...view.store.require("ArmyProgress", { game_id: 1, explorer_id: ARMY }),
          xp: 1000,
        }),
      ] as never);
    view.sendMax();
    expect(view.text()).toContain("Army 1 survives");
    if (when === "during relic handoff") {
      view.systemCalls.troop_troop_adjacent_transfer.mockImplementation(async () => changeWinner());
    }
    await act(async () => {
      // Deliver facts and click before React has rendered the new preview.
      if (when === "before confirmation") changeWinner();
      view.send().click();
    });
    expect(view.systemCalls.explorer_explorer_swap).not.toHaveBeenCalled();
    expect(view.systemCalls.troop_troop_adjacent_transfer).toHaveBeenCalledTimes(
      when === "before confirmation" ? 0 : 1,
    );
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({ message: "The armies changed. Review the merge before confirming again." }),
      "The troops could not be moved.",
    );
    expect(view.text()).toContain("Army 2 survives");
    view.unmount();
  },
);
