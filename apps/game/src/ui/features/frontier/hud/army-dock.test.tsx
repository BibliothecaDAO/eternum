import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 3,
  useCurrentArmiesTick: () => 3,
  useNowSeconds: () => 350,
}));
const layout = { current: "phone" };
vi.mock("@/shell/frame/layout", () => ({ useLayout: () => layout.current }));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";

import { frontierDay } from "../deploy/deploy-fixture";
import { ArmyDock } from "./army-dock";
import { frontierSeasonOnePreset } from "../../../../../../../config/source/frontier/season-one";
import {
  formatAmount,
  FRONTIER_TROOP_NAMES,
  LAYER_NAMES,
  RESOURCE_PRECISION,
  ResourcesIds,
  TroopType,
} from "@bibliothecadao/types";

const BELOW_SURFACE = LAYER_NAMES.slice(1)
  .map((name) => `[aria-label="${name}"]`)
  .join(",");

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
  useUIStore.getState().setPendingMilitaryAction(null);
});

it.each(["phone", "desktop"])("shows every open slot and its bar on %s, and opens the chosen slot", (mode) => {
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
    expect(
      slots.map((slot) => {
        const meter = (slot.closest(".ui-row") ?? slot).querySelector('[role="meter"]');
        return [
          (slot.closest<HTMLElement>(".ui-row") ?? slot).dataset.tip,
          meter?.getAttribute("aria-valuenow"),
          meter?.getAttribute("aria-valuemax"),
        ];
      }),
    ).toEqual([
      ["Army 2 starts full: 150/150 stamina.", "150", "150"],
      ["Army 3 starts on 7/150 stamina.", "7", "150"],
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
  "marks on a %s each army in an Ethereal layer with that layer, and an army on the surface with nothing",
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
  "on a founded Realm with no army on %s, offers open Deploy slots and shows the preset Knights at home",
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
      const expectedCount = formatAmount(startingKnights);
      const expectedLabel = `${expectedCount} ${FRONTIER_TROOP_NAMES[TroopType.Knight]}`;
      if (size === "desktop") {
        expect(slots[0].textContent).toContain(expectedLabel);
      } else {
        expect(slots[0].textContent).toContain(expectedCount);
        expect(slots[0].querySelector(`[aria-label="${expectedLabel}"]`)).not.toBeNull();
      }
      act(() => slots[0].click());
      expect(useUIStore.getState().pendingMilitaryAction).toMatchObject({ structureId: 7, slot: 0 });
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  },
);
