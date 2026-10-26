// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { HudRarity } from "./hud-elements";

const rarity = (node: React.ReactElement) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(node);
  return host.querySelector<HTMLElement>(".ui-rarity")!;
};

it("names a chest's rarity and fills one pip a step, common to legendary", () => {
  for (const [tier, name] of [
    [1, "Common"],
    [2, "Uncommon"],
    [3, "Rare"],
    [4, "Epic"],
    [5, "Legendary"],
  ] as const) {
    const chip = rarity(<HudRarity tier={tier} />);
    expect(chip.getAttribute("aria-label")).toBe(name);
    expect(chip.querySelectorAll("i")).toHaveLength(4);
    expect(chip.querySelectorAll("i[data-filled]")).toHaveLength(tier - 1);
    expect(chip.textContent).toBe("");
  }
});

it("says its word beside the pips only where asked", () => {
  expect(rarity(<HudRarity tier={4} word />).textContent).toBe("Epic");
});
