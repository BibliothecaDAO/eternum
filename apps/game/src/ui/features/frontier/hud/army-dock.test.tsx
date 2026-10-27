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

/** Two armies out, as useDockArmies reads them: 1,498 troops whose Homecoming returns 134, and one of a single troop. */
const ARMIES_OUT = [
  { explorerId: 201, number: 1, troops: 1_498, returnsHome: 134 },
  { explorerId: 202, number: 2, troops: 1, returnsHome: 0 },
].map((army) => ({
  ...army,
  troopsFact: {} as never,
  label: `Army ${army.number}`,
  art: "knight-t1" as const,
  xp: 40,
  xpGoal: undefined,
  tiers: undefined,
  stamina: { current: 60, max: 120, perExplore: 20 },
  secondsToFull: undefined,
  canSpendSkillPoint: false,
}));

it.each(["phone", "desktop"] as const)(
  "shows by each army on a %s what its Homecoming sends home, in the day's last hour only",
  (size) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    layout.current = size;
    // The realm's player, whose armies are buttons on their dock.
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const { store, row } = frontierDay();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const draw = (lastHour: boolean) =>
      act(() =>
        root.render(
          <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
            <ArmyDock realm={row} armies={ARMIES_OUT} lastHour={lastHour} />
          </GameProvider>,
        ),
      );
    /** What each army's own button says comes home, beside its troops. */
    const returns = () =>
      ARMIES_OUT.map(({ label }) =>
        host
          .querySelector(`button[aria-label="${label}"]`)!
          .querySelector('[aria-label$="come home when the day ends"]')
          ?.getAttribute("aria-label"),
      );
    try {
      draw(false);
      expect(returns()).toEqual([undefined, undefined]);
      draw(true);
      expect(returns()).toEqual(["134 come home when the day ends", "0 come home when the day ends"]);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  },
);
