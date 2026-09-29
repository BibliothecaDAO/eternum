import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { UpgradeSheet } from "./upgrade-sheet";
import type { UpgradePlan } from "./upgrade-plan";

const step = (tier: 1 | 2, value: number) => ({
  art: "/farm.png",
  tier,
  gain: { icon: "/wheat.png", value, perHour: true },
});
const plan = (overrides: Partial<UpgradePlan> = {}): UpgradePlan => ({
  name: "Farm",
  doubled: true,
  population: 1,
  now: step(1, 600),
  next: step(2, 1_200),
  price: [{ resource: 25, amount: 200 }],
  affordable: true,
  ...overrides,
});

const render = (value: UpgradePlan, upgrade = vi.fn(() => Promise.resolve())) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<UpgradeSheet plan={value} upgrade={upgrade} onClose={() => {}} />));
  const button = () =>
    [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.startsWith("Upgrade"));
  return { host, root, button, upgrade };
};

describe("the upgrade sheet", () => {
  it("shows now and next with the plot's ×2, and upgrades only when the realm holds the price", async () => {
    const ready = render(plan());
    expect(ready.host.querySelector('[aria-label="Doubled on this plot"]')).not.toBeNull();
    expect([...ready.host.querySelectorAll(".frontier-tier")].map((banner) => banner.textContent)).toEqual(["I", "II"]);
    await act(async () => ready.button()!.click());
    expect(ready.upgrade).toHaveBeenCalledOnce();
    act(() => ready.root.unmount());

    const poor = render(plan({ affordable: false }));
    expect(poor.button()!.disabled).toBe(true);
    act(() => poor.root.unmount());

    const top = render(plan({ next: null }));
    expect(top.button()).toBeUndefined();
    act(() => top.root.unmount());
  });
});
