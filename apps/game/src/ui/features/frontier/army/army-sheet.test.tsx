import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AttributeKey, ArmySheet } from "./army-sheet";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const EFFECTS = {
  battle: ["+0%", "+10%", "+30%", "+60%", "+100%"],
  logistics: ["150", "170", "200", "240", "300"],
  scouting: ["+0%", "+10%", "+30%", "+60%", "+100%"],
  homecoming: ["0%", "3%", "9%", "18%", "30%"],
} as const;

const render = (
  chosen: AttributeKey,
  overrides: { xp?: number; stamina?: number } = {},
  onUpgrade = vi.fn(),
  onKind = vi.fn(),
) =>
  act(() =>
    root.render(
      <ArmySheet
        name="Army 1"
        art="/images/armies/knightT1.png"
        troops={5_000}
        xp={overrides.xp ?? 260}
        stamina={{ current: overrides.stamina ?? 90, max: 150, secondsToFull: 7_200 }}
        attributes={{
          battle: { tier: 3 },
          logistics: { tier: 1 },
          scouting: { tier: 1 },
          homecoming: { tier: 5 },
        }}
        tierPrices={{ 2: 100, 3: 200, 4: 400, 5: 800 }}
        effects={EFFECTS}
        refillOnBuy={30}
        chosen={chosen}
        onChoose={() => {}}
        kindRates={{ camp: ["4%", "4.4%"], rift: ["4%", "4.4%"], stragglers: ["6%", "6.6%"] }}
        kind="rift"
        onKind={onKind}
        sending={false}
        onUpgrade={onUpgrade}
        onClose={() => {}}
      />,
    ),
  );

const row = (word: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${word}"]`)!;
const upgrade = () => [...host.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Upgrade"));

describe("the army", () => {
  it("prices each attribute's next tier in XP, lit when affordable, ember when not, a tick at legendary", () => {
    render("logistics");
    expect(row("Logistics").textContent).toBe("Logistics100XP");
    expect(row("Battle").querySelector(".text-light-red")?.textContent).toBe("400XP");
    expect(row("Homecoming").querySelector('img[src="/image-icons/kit/ui-check.png"]')).not.toBeNull();
  });

  it("buys the chosen tier for its XP price, showing what it changes and the stamina it refills", () => {
    const onUpgrade = vi.fn();
    render("logistics", {}, onUpgrade);
    expect(host.querySelector('[aria-label="Logistics 150 → 170"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="stamina +30"]')).not.toBeNull();
    act(() => upgrade()!.click());
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("refills only what fits on a nearly full bar, and puts the XP held against the price in Upgrade's place", () => {
    render("logistics", { stamina: 140 });
    expect(host.querySelector('[aria-label="stamina +10"]')).not.toBeNull();
    render("battle");
    expect(upgrade()).toBeUndefined();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("260 / 400XP");
  });

  it("chooses Scouting's kind with each kind's find rate before and after", () => {
    const onKind = vi.fn();
    render("scouting", {}, vi.fn(), onKind);
    const camps = host.querySelector<HTMLButtonElement>('[aria-label="Find camps"]')!;
    expect(camps.textContent).toBe("4%→4.4%");
    expect(host.querySelector('[aria-label="Find rifts"]')?.getAttribute("aria-checked")).toBe("true");
    act(() => camps.click());
    expect(onKind).toHaveBeenCalledWith("camp");
  });
});
