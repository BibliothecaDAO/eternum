// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const mode = vi.hoisted(() => ({ id: "blitz" }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => mode }));

import { GameProvider } from "@/hooks/context/game-context";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { GuardDismissal } from "./guard-dismissal";

afterEach(() => setBlockTimestampSource(null));

/** The fixture realm with one guard slot holding 300 knights, its Dismiss guard control mounted in the given game. */
const mount = (id: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mode.id = id;
  const { store, row } = frontierDay();
  store.applyFacts([
    { model: "Structure", key: "0x7", value: { ...row, base: { ...row.base, troop_max_guard_count: 1 } } },
    {
      model: "Guard",
      key: "0x9a0",
      value: {
        game_id: 1,
        structure_id: 7,
        slot: 0,
        troops: { ...rowFixture.expected.value.troops, count: String(300n * 1_000_000_000n) },
        destroyed_tick: 0,
      },
    },
  ] as never);
  const guard_delete = vi.fn(async () => {});
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider
        value={{ store, systemCalls: { guard_delete } } as unknown as GameClientSetup}
        account={{ address: "0x111" } as never}
      >
        <GuardDismissal structureId={7} slot={0} disabled={false} onDismissed={() => {}} />
      </GameProvider>,
    ),
  );
  const press = (text: string) =>
    act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === text)!.click());
  return {
    guard_delete,
    press,
    dialog: () => host.querySelector('[role="alertdialog"]'),
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
};

describe("dismissing a guard", () => {
  it("acts at once in Blitz and Eternum, where time is of the essence", async () => {
    for (const id of ["blitz", "eternum"]) {
      const view = mount(id);
      await view.press("Dismiss guard");
      expect(view.dialog()).toBeNull();
      expect(view.guard_delete).toHaveBeenCalledWith(expect.objectContaining({ for_structure_id: 7, slot: 0 }));
      view.unmount();
    }
  });

  it("asks first in Frontier, where its troops are lost for good", async () => {
    const view = mount("frontier");
    await view.press("Dismiss guard");
    expect(view.guard_delete).not.toHaveBeenCalled();
    expect(view.dialog()?.getAttribute("aria-label")).toBe("Dismiss guard in slot 1?");
    await view.press("Confirm dismissal");
    expect(view.guard_delete).toHaveBeenCalledWith(expect.objectContaining({ for_structure_id: 7, slot: 0 }));
    view.unmount();
  });
});
