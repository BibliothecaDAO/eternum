import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEEP_BEASTS } from "@bibliothecadao/types";

import { ARMY, DEEP_WORDS } from "@/ui/design-system/kit/words";
import { DEEP_SITE_CASES } from "./deep-site-fixtures";
import { DeepSiteView, type DeepSiteProps } from "./deep-site-view";

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

const draw = (props: DeepSiteProps) => act(() => root.render(<DeepSiteView {...props} />));
const text = () => document.body.textContent ?? "";
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>("section[role=dialog] button")];
const labels = (names: string[]) =>
  buttons().filter((button) => names.some((name) => button.textContent?.startsWith(name)));

describe("a Deep site's card", () => {
  it("names the site, its state and ring, pays per army tick, and draws its fixed beast with its Blade or Bow on the portrait", () => {
    const onAct = vi.fn();
    const props = DEEP_SITE_CASES["Hyperstructure archive, open, its beast, army in reach"];
    draw({ ...props, order: { kind: "act", verb: "attack", stamina: 30, onAct } });
    expect(document.querySelector("[data-deep-tag]")?.textContent).toBe("Open · Ring 1");
    expect(document.querySelector(".deep-title__name")?.textContent).toBe("Hyperstructure archive");
    expect(document.querySelector(".deep-title__purpose")?.textContent).toBe(DEEP_WORDS.purpose.foundation);
    const rates = [...document.querySelectorAll("[data-rate]")].map((rate) => [
      rate.getAttribute("data-rate"),
      rate.textContent,
    ]);
    expect(rates).toEqual([
      ["glory", DEEP_WORDS.splitCell("+6/ 2mGlory")],
      ["height", "+6/ 2mAspect height"],
    ]);
    const beast = document.querySelector("[data-deep-beast]")!;
    expect(beast.querySelector(".deep-beast__name")?.textContent).toBe(`${DEEP_BEASTS.foundation.name}Blade`);
    expect(beast.querySelector(".deep-beast__portrait [data-combat-mark='Blade']")).not.toBeNull();
    expect(beast.textContent).toContain("15,000 troops");
    expect(document.querySelector("[data-deep-poison]")?.textContent).toBe(DEEP_WORDS.poisonStrip(200, "2m"));
    expect(text()).not.toContain("Today's beast");
    const [attack] = labels(["Attack"]);
    act(() => attack!.click());
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("pays Labor per tick with its rate a minute and the guard drain beside it, held by the player's Aspect", () => {
    draw(DEEP_SITE_CASES["Ethereal mine held by the player's Aspect, slots to join"]);
    expect(document.querySelector("[data-deep-tag]")?.textContent).toBe("Held · Luminary");
    expect([...document.querySelectorAll("[data-rate]")].map((rate) => rate.textContent)).toEqual([
      DEEP_WORDS.splitCell("+300/ 2m+150/min"),
      `−200/ 2m${DEEP_WORDS.poisonCell}`,
    ]);
    expect(document.querySelector("[data-aspect-holder='2']")?.textContent).toBe(
      "Luminary· 2 / 4 Guards · 2 slots open ·Poisoned",
    );
    expect(document.querySelector("[data-deep-poison]")).toBeNull();
    expect(document.querySelector("[data-deep-poisoned]")?.textContent).toBe("Poisoned");
    expect(document.querySelector("[data-rate='drain'] [data-icon='poison']")).not.toBeNull();
  });

  it("shows a locked site's yields without its pay, and how many Realms have entered of the ones it needs", () => {
    draw(DEEP_SITE_CASES["Bane altar, locked until more Realms enter"]);
    expect(document.querySelector("[data-deep-tag]")?.textContent).toBe(DEEP_WORDS.tag.locked(2));
    expect(document.querySelector("[data-deep-pay]")).toBeNull();
    expect(document.querySelector("[data-deep-kinds]")?.textContent).toBe("GloryBane barRates set when open");
    expect(document.querySelector("[data-deep-opening]")?.textContent).toBe("Opens at 50 Realms today12 / 50");
    expect(document.querySelector("[data-deep-beast] [data-combat-mark='Bow']")).not.toBeNull();
    expect(document.querySelector("[data-deep-poison]")).toBeNull();
    expect(labels(["Attack"])).toHaveLength(0);
  });

  it("tags a site a rival Aspect holds with its guards, and offers Attack", () => {
    draw(DEEP_SITE_CASES["Essence core held by a rival Aspect"]);
    expect(document.querySelector("[data-deep-tag]")?.textContent).toBe("Rival · Havoc · 1/4");
    expect(document.querySelector("[data-deep-tag]")?.getAttribute("data-deep-tag")).toBe("rival");
    expect(labels(["Attack"])).toHaveLength(1);
  });

  it("holds Attack disabled and says why when the stamina is short", () => {
    draw(DEEP_SITE_CASES["Ethereal mine, its beast, army short of stamina"]);
    expect(labels(["Attack"])[0]!.disabled).toBe(true);
    expect(text()).toContain("Needs 30 stamina, holds 12");
  });

  it("offers Move with its cost when the army is away, and shows the Bane bar's charge on its rate", () => {
    const onMove = vi.fn();
    draw({
      ...DEEP_SITE_CASES["Bane altar, open, no guard, army away"],
      order: { kind: "move", prices: [{ of: "stamina", amount: 30 }], onMove },
    });
    expect(text()).toContain(DEEP_WORDS.open);
    expect(document.querySelector("[data-rate='bar']")?.getAttribute("data-tip")).toBe("300 of 1,500");
    act(() => labels(["Move"])[0]!.click());
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("draws a rival's guards in fight order with detail in tooltips, and the poison strip when the rates hold no drain", () => {
    const fixture = DEEP_SITE_CASES["Essence core held by a rival Aspect"];
    draw({
      ...fixture,
      site: "foundation",
      rates: { ...fixture.rates, essence: 0, glory: 6, height: 6 },
      guard: {
        ...fixture.guard,
        aspectId: 1,
        slots: withTwoGuards(),
      },
    });
    const slots = [...document.querySelectorAll("[data-deep-slot]")];
    expect(slots).toHaveLength(4);
    const tips = slots
      .filter((slot) => slot.getAttribute("data-deep-slot") === "filled")
      .map((slot) => slot.getAttribute("data-tip") ?? "");
    expect(tips[0]).toContain("Aldor · fought next");
    expect(tips[0]).toContain(DEEP_WORDS.share(60));
    expect(tips[1]).toContain(DEEP_WORDS.share(40));
    expect(document.querySelector("[data-deep-poison]")?.textContent).toBe(DEEP_WORDS.poisonStrip(200, "2m"));
  });

  it("renders facing portraits named by their sides, each before → after, and stamina cost on Attack", () => {
    const fixture = DEEP_SITE_CASES["Essence core held by a rival Aspect"];
    draw({
      ...fixture,
      fight: {
        army: 1_000,
        defender: 6_200,
        attackerTroops: { category: "Crossbowman", tier: "T1" },
        defenderTroops: { category: "Knight", tier: "T1" },
        result: { troopsLost: 330, guardLeft: 5_446 },
      },
    });
    const sides = [...document.querySelectorAll(".fight-side")];
    expect(sides).toHaveLength(2);
    expect(sides[0]!.getAttribute("aria-label")?.startsWith(`${ARMY} 1,000 → 670`)).toBe(true);
    expect(sides[1]!.getAttribute("aria-label")).toContain("Havoc Guard 6,200 → 5,446");
    expect(document.querySelector("[data-attack-stamina='30']")).not.toBeNull();
    expect(sides[1]!.querySelector("[data-aspect-mark='3']")).not.toBeNull();
  });

  it("shows the beast's fight in place of its row, the Blade or Bow on the beast's portrait", () => {
    const fixture = DEEP_SITE_CASES["Hyperstructure archive, open, its beast, army in reach"];
    draw({
      ...fixture,
      fight: {
        army: 12_400,
        defender: 15_000,
        attackerTroops: { category: "Knight", tier: "T1" },
        defenderTroops: { category: "Knight", tier: "T1" },
        result: { troopsLost: 4_580, guardLeft: 0 },
      },
    });
    expect(document.querySelector("[data-deep-beast]")).toBeNull();
    const theirs = document.querySelector("[data-fight-side='theirs']")!;
    expect(theirs.querySelector("[data-combat-mark='Blade']")).not.toBeNull();
    expect(theirs.textContent).toContain("Defeated");
  });
});

const withTwoGuards = () => {
  const fixture = DEEP_SITE_CASES["Ethereal mine held by the player's Aspect, slots to join"];
  return fixture.guard.slots;
};
