// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { HudTier, HudTierStep } from "./hud-elements";

const drawn = (node: React.ReactElement) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(node);
  return host;
};

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
