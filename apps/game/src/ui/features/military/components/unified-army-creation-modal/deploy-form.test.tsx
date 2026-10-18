// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { HudWindow } from "@/ui/design-system/kit/hud-elements";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { DeployTroops, DeployVerb } from "./deploy-form";
import type { useArmyCreation } from "./use-army-creation";

type Form = ReturnType<typeof useArmyCreation>;

/** A realm holding 300 Knight T1 and 120 Paladin T3; its guard slot, when locked, holds Paladin T3. */
const form = (patch: Partial<Form> = {}): Form =>
  ({
    troopOptions: [
      {
        type: TroopType.Knight,
        label: "Knight",
        tiers: [
          { tier: TroopTier.T1, available: 300, resourceId: getTroopResourceId(TroopType.Knight, TroopTier.T1) },
          { tier: TroopTier.T2, available: 0, resourceId: getTroopResourceId(TroopType.Knight, TroopTier.T2) },
          { tier: TroopTier.T3, available: 0, resourceId: getTroopResourceId(TroopType.Knight, TroopTier.T3) },
        ],
      },
      {
        type: TroopType.Paladin,
        label: "Paladin",
        tiers: [
          { tier: TroopTier.T1, available: 0, resourceId: getTroopResourceId(TroopType.Paladin, TroopTier.T1) },
          { tier: TroopTier.T2, available: 0, resourceId: getTroopResourceId(TroopType.Paladin, TroopTier.T2) },
          { tier: TroopTier.T3, available: 120, resourceId: getTroopResourceId(TroopType.Paladin, TroopTier.T3) },
        ],
      },
    ],
    selectedTroopCombo: { type: TroopType.Knight, tier: TroopTier.T1 },
    isDefenseTroopLocked: false,
    selectedGuardCategory: undefined,
    selectedGuardTier: undefined,
    handleTroopSelect: vi.fn(),
    troopCount: 100,
    maxAffordable: 300,
    handleTroopCountChange: vi.fn(),
    isActionDisabled: false,
    blockedReason: null,
    isLoading: false,
    raisePrices: [{ icon: "wheat", word: "wheat", amount: "200" }],
    handleCreate: vi.fn(),
    ...patch,
  }) as unknown as Form;

const render = (node: React.ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(node));
  return host;
};
const stack = (host: HTMLElement, name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>(".ui-deploy__troop button")].find((each) =>
    each.getAttribute("aria-label")!.startsWith(name),
  )!;

describe("the deploy form on the sheet", () => {
  it("chooses a held stack by its column and tier", () => {
    const chosen = form();
    const host = render(<DeployTroops form={chosen} />);
    act(() => stack(host, "Paladin T3").click());
    expect(chosen.handleTroopSelect).toHaveBeenCalledWith(TroopType.Paladin, TroopTier.T3);
    expect(stack(host, "Knight T1").getAttribute("aria-pressed")).toBe("true");
  });

  it("takes only the troop a held guard slot holds, the realm's other troops shut", () => {
    const locked = form({
      isDefenseTroopLocked: true,
      selectedGuardCategory: TroopType.Paladin,
      selectedGuardTier: TroopTier.T3,
      selectedTroopCombo: { type: TroopType.Paladin, tier: TroopTier.T3 },
    });
    const host = render(<DeployTroops form={locked} />);
    expect(stack(host, "Knight T1").disabled).toBe(true);
    expect(stack(host, "Paladin T3").disabled).toBe(false);
  });

  it("puts Deploy with its price in the window's foot, and its one reason beside it when it cannot go", () => {
    const ready = render(
      <HudWindow title="Deploy field army" onClose={() => undefined}>
        <DeployVerb form={form()} />
      </HudWindow>,
    );
    const verb = ready.querySelector<HTMLButtonElement>(".ui-window__foot .ui-button")!;
    expect(verb.disabled).toBe(false);
    expect(verb.querySelector('[aria-label="200 wheat"]')).not.toBeNull();
    expect(ready.querySelector('[role="status"]')?.textContent).toBe("");

    const blocked = render(
      <HudWindow title="Deploy field army" onClose={() => undefined}>
        <DeployVerb form={form({ isActionDisabled: true, blockedReason: "No free spawn hex." })} />
      </HudWindow>,
    );
    expect(blocked.querySelector<HTMLButtonElement>(".ui-window__foot .ui-button")!.disabled).toBe(true);
    expect(blocked.querySelector('.ui-window__foot [role="status"]')?.textContent).toBe("No free spawn hex.");
  });
});
