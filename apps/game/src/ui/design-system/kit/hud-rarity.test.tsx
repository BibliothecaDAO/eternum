// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { HudRarity, HudTier, HudTierStep } from "./hud-elements";

const drawn = (node: React.ReactElement) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(node);
  return host;
};

it("says a chest's rarity by its word, on a plate of its colour, with no pips", () => {
  for (const [tier, name] of [
    [1, "Common"],
    [3, "Rare"],
    [5, "Legendary"],
  ] as const) {
    const chip = drawn(<HudRarity tier={tier} />).querySelector<HTMLElement>(".ui-rarity")!;
    expect(chip.textContent).toBe(name);
    expect(chip.dataset.tier).toBe(String(tier));
    expect(chip.querySelectorAll("i")).toHaveLength(0);
  }
});

it("draws a levelled tier as a gem with its numeral, Uncommon I to Legendary IV, and nothing at Common", () => {
  expect(drawn(<HudTier tier={1} />).innerHTML).toBe("");
  for (const [tier, numeral, name] of [
    [2, "I", "Uncommon"],
    [3, "II", "Rare"],
    [5, "IV", "Legendary"],
  ] as const) {
    const gem = drawn(<HudTier tier={tier} />).querySelector<HTMLElement>(".ui-tier")!;
    expect(gem.textContent).toBe(numeral);
    expect(gem.getAttribute("aria-label")).toBe(name);
    expect(gem.dataset.tier).toBe(String(tier));
  }
});

it("steps from the gem held to the next, with none before the first", () => {
  expect(drawn(<HudTierStep from={1} to={2} />).textContent).toBe("→I");
  const step = drawn(<HudTierStep from={3} to={4} />);
  expect(step.textContent).toBe("II→III");
  expect(step.querySelector("[role='img']")?.getAttribute("aria-label")).toBe("Rare → Epic");
});
