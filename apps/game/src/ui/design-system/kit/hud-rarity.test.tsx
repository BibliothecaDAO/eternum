// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { HudRarity, HudTier } from "./hud-elements";

const plate = (node: React.ReactElement) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(node);
  return host.querySelector<HTMLElement>(".ui-rarity")!;
};

it("says a chest's rarity by its word, on a plate of its colour, with no pips", () => {
  for (const [tier, name] of [
    [1, "Common"],
    [3, "Rare"],
    [5, "Legendary"],
  ] as const) {
    const chip = plate(<HudRarity tier={tier} />);
    expect(chip.textContent).toBe(name);
    expect(chip.dataset.tier).toBe(String(tier));
    expect(chip.querySelectorAll("i")).toHaveLength(0);
  }
});

it("fills one pip a step for a tier the player levels, named for assistive technology", () => {
  const chip = plate(<HudTier tier={2} />);
  expect(chip.getAttribute("aria-label")).toBe("Uncommon");
  expect(chip.querySelectorAll("i")).toHaveLength(5);
  expect(chip.querySelectorAll("i[data-filled]")).toHaveLength(2);
  expect(chip.textContent).toBe("");
});
