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
    const slots = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Deploy Army"]')];
    expect(
      slots.map((slot) => {
        const meter = slot.querySelector('[role="meter"]');
        return [slot.dataset.tip, meter?.getAttribute("aria-valuenow"), meter?.getAttribute("aria-valuemax")];
      }),
    ).toEqual([
      ["Army 2 starts full: 150/150 stamina. Its slot is fresh today.", "150", "150"],
      ["Army 3 starts on 7/150 stamina. The bar its slot's last army left.", "7", "150"],
    ]);
    act(() => slots[1].click());
    expect(useUIStore.getState().pendingMilitaryAction).toMatchObject({ structureId: 7, slot: 2 });
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
