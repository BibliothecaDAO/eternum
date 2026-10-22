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
    const slots = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label="Deploy"]')];
    expect(
      slots.map((slot) => {
        const meter = slot.querySelector('[role="meter"]');
        return [slot.dataset.tip, meter?.getAttribute("aria-valuenow"), meter?.getAttribute("aria-valuemax")];
      }),
    ).toEqual([
      ["Army 2 starts full: 150/150 stamina. Its slot is fresh today.", "150", "150"],
      ["Army 3 starts on 7/150 stamina. The bar its slot's last army left.", "7", "150"],
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
    const deploys = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label="Deploy"]')];
    expect(deploys.map((slot) => slot.dataset.tip)).toEqual([
      "Army 2 starts full: 150/150 stamina. Its slot is fresh today.",
    ]);
    const waiting = host.querySelector<HTMLElement>('[role="group"][aria-label="Army 3"]')!;
    expect(waiting.dataset.tip).toBe("Army 3 starts on 7/150 stamina. The bar its slot's last army left.");
    expect(waiting.querySelector("button")).toBeNull();
    expect(waiting.textContent).toMatch(/^3Army 3/);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
