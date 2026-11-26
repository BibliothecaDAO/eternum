import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 3,
  useCurrentArmiesTick: () => 3,
  useNowSeconds: () => 350,
}));
const layout = { current: "phone" };
vi.mock("@/hooks/helpers/use-compact-hud", async (original) => ({
  ...(await original<typeof import("@/hooks/helpers/use-compact-hud")>()),
  useHudLayout: () => layout.current,
}));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";

import { frontierDay } from "../deploy/deploy-fixture";
import { ArmyDock, readArmySlots } from "./army-dock";
import { frontierSeasonOnePreset } from "../../../../../../../config/source/frontier/season-one";
import { LAYER_NAMES, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { startsOn } from "@/ui/design-system/kit/words";

const BELOW_SURFACE = LAYER_NAMES.slice(1)
  .map((name) => `[aria-label="${name}"]`)
  .join(",");

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
  useUIStore.getState().setPendingMilitaryAction(null);
});

it.each(["phone", "desktop"])("shows every open slot and its start on %s, and opens the chosen slot", (mode) => {
  layout.current = mode;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store, row } = frontierDay();
  // Slot 2 is fresh today; slot 3's army was released this second with 7 stamina left.
  store.applyFacts([
    {
      model: "ArmySlot",
      key: "0x92",
      value: {
        game_id: 1,
        structure_id: 7,
        epoch: "0",
        slot: 2,
        explorer_id: 0,
        stamina: { amount: "7", settled_at: "3", remainder: 0 },
      },
    },
  ] as never);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <ArmyDock realm={row} armies={[]} />
      </GameProvider>,
    ),
  );
  try {
    const slots = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label="Deploy"]')];
    const startOf = (slot: HTMLButtonElement) => {
      const row = slot.closest<HTMLElement>(".frontier-slot") ?? slot;
      return [
        row.dataset.tip,
        row.querySelector('[role="meter"]')?.getAttribute("aria-valuenow"),
        row.querySelector(".frontier-slot__detail"),
      ];
    };
    expect(slots.map(startOf)).toEqual([
      [`${startsOn("Army 2", "150/150", true)}.`, "150", null],
      ["Army 3 starts on 7/150 stamina.", "7", null],
    ]);
    act(() => slots[1].click());
    expect(useUIStore.getState().pendingMilitaryAction).toMatchObject({ structureId: 7, slot: 2 });
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

/**
 * Two armies out, as useDockArmies reads them: 1,498 troops whose Homecoming returns 134, through the spire in
 * Ethereal II, and one of a single troop on the surface.
 */
const ARMIES_OUT = [
  { explorerId: 201, number: 1, troops: 1_498, returnsHome: 134, ethereal: 2 as const },
  { explorerId: 202, number: 2, troops: 1, returnsHome: 0, ethereal: undefined },
].map((army) => ({
  ...army,
  troopsFact: {} as never,
  label: `Army ${army.number}`,
  art: "knight-t1" as const,
  stamina: { current: 60, max: 120, perExplore: 20 },
  secondsToFull: undefined,
}));

it.each(["phone", "desktop"] as const)(
  "marks on a %s each army in an Ethereal layer with that layer's painting and no words, and an army on the surface with nothing",
  (size) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    layout.current = size;
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const { store, row } = frontierDay();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <ArmyDock realm={row} armies={ARMIES_OUT} />
        </GameProvider>,
      ),
    );
    try {
      // Each army's own button: the layer's name, and the numeral it shows beside the layer's painting.
      const marks = ARMIES_OUT.map(({ label }) => {
        const mark = host.querySelector(`button[aria-label="${label}"]`)!.querySelector(BELOW_SURFACE);
        return mark && [mark.getAttribute("aria-label"), mark.textContent, mark.querySelector("img")?.dataset.icon];
      });
      expect(marks).toEqual([["Hollow", "", "depth-2"], null]);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  },
);

it.each(["phone", "desktop"] as const)(
  "makes each army on a %s a button that is pressed when picked, and Deploy a button that only deploys",
  (size) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    layout.current = size;
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const { store, row } = frontierDay();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <ArmyDock realm={row} armies={ARMIES_OUT} />
        </GameProvider>,
      ),
    );
    try {
      const toggles = [...host.querySelectorAll('nav[aria-label="Armies"] button[aria-pressed]')];
      expect(toggles.map((button) => [button.getAttribute("aria-label"), button.getAttribute("aria-pressed")])).toEqual(
        [
          ["Army 1", "false"],
          ["Army 2", "false"],
        ],
      );
      expect(host.querySelector('nav[aria-label="Armies"] button[aria-label="Deploy"]')).not.toBeNull();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  },
);

it.each(["phone", "desktop"] as const)(
  "on a founded Realm with no army on %s, offers open Deploy slots, each with the stamina its army starts on",
  (size) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    layout.current = size;
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const { store, row } = frontierDay();
    const startingKnights = frontierSeasonOnePreset.balance.startingResources.find(
      (entry) => entry.resource === ResourcesIds.Knight,
    )!.amount;
    const startingWheat = frontierSeasonOnePreset.balance.startingResources.find(
      (entry) => entry.resource === ResourcesIds.Wheat,
    )!.amount;
    store.applyFacts([
      {
        model: "ArmySlot",
        key: "0x9",
        value: {
          game_id: 1,
          structure_id: 7,
          epoch: "0",
          slot: 0,
          explorer_id: 0,
          stamina: { amount: "150", settled_at: "350", remainder: 0 },
        },
      },
      {
        model: "ResourceBalance",
        key: "0x8",
        value: {
          game_id: 1,
          entity_id: 7,
          resource_type: ResourcesIds.Knight,
          balance: String(BigInt(startingKnights) * BigInt(RESOURCE_PRECISION)),
        },
      },
      {
        model: "ResourceBalance",
        key: "0xc",
        value: {
          game_id: 1,
          entity_id: 7,
          resource_type: ResourcesIds.Wheat,
          balance: String(BigInt(startingWheat) * BigInt(RESOURCE_PRECISION)),
        },
      },
    ] as never);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <ArmyDock realm={row} armies={[]} />
        </GameProvider>,
      ),
    );
    try {
      const slots = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label="Deploy"]')];
      expect(slots).toHaveLength(row.base.troop_max_explorer_count);
      const start = (slot: HTMLButtonElement) => {
        const row = slot.closest<HTMLElement>(".frontier-slot") ?? slot;
        return [row.querySelector('[role="meter"]') !== null, row.querySelector(".frontier-slot__detail")];
      };
      expect(slots.map(start)).toEqual(slots.map(() => [true, null]));
      expect(
        (slots[0].closest(".frontier-slot") ?? slots[0]).querySelector('[role="meter"]')?.getAttribute("aria-valuenow"),
      ).toBe("150");
      act(() => slots[0].click());
      expect(useUIStore.getState().pendingMilitaryAction).toMatchObject({ structureId: 7, slot: 0 });
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  },
);

it("names the next slot past the realm's allowance with the rank that unlocks it, and none once every slot is open", () => {
  const limits = { settlement_armies: 3, city_armies: 4, kingdom_armies: 4, empire_armies: 6 } as never;
  expect(readArmySlots(limits, 1, 3)).toEqual({
    count: "1/3",
    nextLocked: { number: 4, rank: "City" },
  });
  expect(readArmySlots(limits, 2, 4)).toEqual({
    count: "2/4",
    nextLocked: { number: 5, rank: "Empire" },
  });
  expect(readArmySlots(limits, 6, 6)).toEqual({ count: "6/6", nextLocked: undefined });
});
