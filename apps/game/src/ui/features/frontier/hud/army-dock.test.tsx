import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 3,
  useCurrentArmiesTick: () => 3,
  useNowSeconds: () => 350,
}));
const layout = vi.hoisted(() => ({ is: "phone" as "phone" | "desktop" }));
vi.mock("@/shell/frame/layout", () => ({ useLayout: () => layout.is }));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";

import { frontierDay } from "../deploy/deploy-fixture";
import { ArmyDock } from "./army-dock";

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
  layout.is = "phone";
});

/** The fixture's realm with slot 2 fresh today and slot 3's army released this second with 7 stamina left. */
const dayWithTwoOpenSlots = () => {
  const day = frontierDay();
  day.store.applyFacts([
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
  return day;
};

it("shows on each open slot of the dock the bar it starts its army on, as the Deploy sheet reads it", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store, row } = dayWithTwoOpenSlots();
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
    const slots = [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Armies"] button')];
    expect(
      slots.map((slot) => {
        const meter = slot.querySelector('[role="meter"]');
        return [
          slot.getAttribute("aria-label"),
          slot.disabled,
          slot.dataset.tip,
          meter?.getAttribute("aria-valuenow"),
          meter?.getAttribute("aria-valuemax"),
        ];
      }),
    ).toEqual([
      ["Deploy", false, "Army 2 starts full: 150/150 stamina.", "150", "150"],
      ["Deploy fills slot 2 first.", true, "Army 3 starts on 7/150 stamina. Deploy fills slot 2 first.", "7", "150"],
    ]);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("lists every slot on a desktop, Deploy on the lowest open one the contract fills and the later ones waiting", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  layout.is = "desktop";
  const { store, row } = dayWithTwoOpenSlots();
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
    // Each slot is a row of the list, like an army's, its start on its tip and its stamina in the rows' column.
    const deploys = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label="Deploy"]')];
    expect(deploys.map((slot) => slot.closest<HTMLElement>(".ui-row")!.dataset.tip)).toEqual([
      "Army 2 starts full: 150/150 stamina.",
    ]);
    const waiting = [...host.querySelectorAll<HTMLElement>(".ui-row")].find((slot) =>
      slot.textContent?.startsWith("3Army 3"),
    )!;
    expect(waiting.dataset.tip).toBe("Army 3 starts on 7/150 stamina. Deploy fills slot 2 first.");
    expect(waiting.getAttribute("aria-disabled")).toBe("true");
    expect(waiting.querySelector("button")).toBeNull();
    expect(waiting.querySelector('[role="meter"]')!.getAttribute("aria-valuenow")).toBe("7");
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
  canBuyTier: false,
}));

it.each(["phone", "desktop"] as const)(
  "shows by each army on a %s what its Homecoming sends home, in the day's last hour only",
  (size) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    layout.is = size;
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

it.each(["phone", "desktop"] as const)(
  "makes each army on a %s a button that is pressed when picked, and Deploy a button that only deploys",
  (size) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    layout.is = size;
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const { store, row } = dayWithTwoOpenSlots();
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
