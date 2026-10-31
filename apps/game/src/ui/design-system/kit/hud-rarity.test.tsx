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
    [2, "Uncommon"],
    [3, "Rare"],
    [4, "Epic"],
    [5, "Legendary"],
  ] as const) {
    const chip = drawn(<HudRarity tier={tier} />).querySelector<HTMLElement>(".ui-rarity")!;
    expect(chip.textContent).toBe(name);
    expect(chip.dataset.tier).toBe(String(tier));
    expect(chip.querySelectorAll("i")).toHaveLength(0);
  }
});

it("draws a tier as a gem in its rarity's colour, named by its numeral alone, I to V", () => {
  for (const [tier, numeral] of [
    [1, "I"],
    [2, "II"],
    [3, "III"],
    [5, "V"],
  ] as const) {
    const gem = drawn(<HudTier tier={tier} />).querySelector<HTMLElement>(".ui-tier")!;
    expect(gem.textContent).toBe(numeral);
    expect(gem.getAttribute("aria-label")).toBe(numeral);
    expect(gem.dataset.tier).toBe(String(tier));
  }
});

it("steps from the gem held to the next", () => {
  expect(drawn(<HudTierStep from={1} to={2} />).textContent).toBe("I→II");
  const step = drawn(<HudTierStep from={3} to={4} />);
  expect(step.textContent).toBe("III→IV");
  expect(step.querySelector("[role='img']")?.getAttribute("aria-label")).toBe("III → IV");
});
