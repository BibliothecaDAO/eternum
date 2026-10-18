// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { getRelicInfo, RELICS, TroopTier, TroopType } from "@bibliothecadao/types";
import type { WorkingArmy } from "./battle-lab.types";
import { ArmyColumn } from "./army-column";

afterEach(() => setBlockTimestampSource(null));

/** Combat's army column as the simulator holds it: every change it reports is the army it shows next. */
const mount = () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  frontierDay();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let shown: WorkingArmy | null = null;
  const Column = () => {
    const [army, setArmy] = useState<WorkingArmy>({
      troopType: TroopType.Knight,
      tier: TroopTier.T1,
      troopCount: 100,
      stamina: 50,
      battle_cooldown_end: 0,
      relics: [],
    });
    shown = army;
    return (
      <ArmyColumn label="Attacker" side="attacker" army={army} onChange={(patch) => setArmy({ ...army, ...patch })} />
    );
  };
  act(() => root.render(<Column />));
  const button = (name: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
  return {
    army: () => shown!,
    press: (name: string) => act(() => button(name).click()),
    button,
    type: (name: string, text: string) => {
      const input = host.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
};

/** The fight relics the column offers, as the picker it replaced listed them. */
const FIGHT_RELICS = RELICS.filter((relic) => ["Damage", "Damage Reduction", "Stamina"].includes(relic.type));

describe("Combat's army column", () => {
  it("offers every relic that changes a fight, and keeps several on at once", () => {
    const column = mount();
    const [first, second] = FIGHT_RELICS;
    for (const relic of FIGHT_RELICS) expect(column.button(`Add ${relic.name}`), relic.name).not.toBeNull();
    column.press(`Add ${first.name}`);
    column.press(`Add ${second.name}`);
    expect(column.army().relics).toEqual([first.id, second.id]);
    column.press(`Remove ${getRelicInfo(first.id)!.name}`);
    expect(column.army().relics).toEqual([second.id]);
    column.unmount();
  });

  it("sets troops in steps of 100 and never below one, and stamina within its maximum", () => {
    const column = mount();
    column.press("More: Troops");
    expect(column.army().troopCount).toBe(200);
    column.type("Troops", "-5");
    expect(column.army().troopCount).toBe(1);
    column.press("Fewer: Troops");
    expect(column.army().troopCount).toBe(1);
    column.type("Stamina", "99999");
    expect(column.army().stamina).toBeLessThan(99_999);
    expect(column.button("More: Stamina").disabled).toBe(true);
    column.unmount();
  });
});
