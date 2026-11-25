// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { HudTier } from "./hud-elements";

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
