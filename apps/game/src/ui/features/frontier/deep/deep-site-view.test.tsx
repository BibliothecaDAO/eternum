import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEEP_BEASTS } from "@bibliothecadao/types";

import { DEEP_SITE_CASES } from "./deep-site-fixtures";
import { DeepSiteView, type DeepSiteProps } from "./deep-site-view";
import { DEEP_WORDS } from "../../../design-system/kit/words";

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
  it("names the site, what a tick pays and the beast, and Attack sends", () => {
    const onAct = vi.fn();
    const props = DEEP_SITE_CASES["Foundation, today's beast, army in reach"];
    draw({ ...props, order: { kind: "act", verb: "attack", onAct } });
    expect(text()).toContain("Hyperstructure archive");
    expect(text()).toContain("6 Glory");
    expect(text()).toContain(DEEP_WORDS.height(6));
    expect(text()).toContain(`Guard: ${DEEP_BEASTS.foundation.name}, 10,000 troops`);
    const [attack] = labels(["Attack"]);
    act(() => attack!.click());
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("holds Attack disabled and says why when the stamina is short", () => {
    draw(DEEP_SITE_CASES["Ethereal mine, army short of stamina"]);
    expect(labels(["Attack"])[0]!.disabled).toBe(true);
    expect(text()).toContain("Needs 30 stamina, holds 12");
  });

  it("says how many Realms must enter today before a closed ring opens, and offers no order", () => {
    draw({ ...DEEP_SITE_CASES["Foundation, today's beast, army in reach"], order: { kind: "closed", realms: 50 } });
    expect(text()).toContain(DEEP_WORDS.opensAt(50));
    expect(labels(["Attack"])).toHaveLength(0);
  });

  it("offers Move with its cost when the army is away", () => {
    const onMove = vi.fn();
    draw({
      ...DEEP_SITE_CASES["Altar, open, army away"],
      order: { kind: "move", prices: [{ of: "stamina", amount: 30 }], onMove },
    });
    expect(text()).toContain(DEEP_WORDS.open);
    expect(text()).toContain("1,500");
    act(() => labels(["Move"])[0]!.click());
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("draws a held site's holder Facet, 4 guard portraits in one row with detail in tooltips, and single drain", () => {
    const fixture = DEEP_SITE_CASES["Foundation held, two slots filled"];
    draw(fixture);
    const holder = document.querySelector("[data-aspect-holder='1']")!;
    expect(holder.textContent).toContain("Held by");
    expect(holder.textContent).toContain("Prowess");
    expect(holder.querySelector("[data-aspect-mark='1']")).not.toBeNull();
    const slots = [...document.querySelectorAll("[data-deep-slot]")];
    expect(slots).toHaveLength(4);
    const filled = slots.filter((slot) => slot.getAttribute("data-deep-slot") === "filled");
    const empty = slots.filter((slot) => slot.getAttribute("data-deep-slot") === "empty");
    expect(filled).toHaveLength(2);
    expect(empty).toHaveLength(2);
    const tips = filled.map((slot) => slot.getAttribute("data-tip") ?? "");
    expect(tips[0]).toContain("Aldor · fought next");
    expect(tips[0]).toContain(DEEP_WORDS.share("75"));
    expect(tips[1]).toContain("Brek");
    expect(tips[1]).toContain(DEEP_WORDS.share("25"));
    for (const [index, slot] of fixture.guard.slots.entries()) {
      expect(tips[index]).toContain(`${slot.ticks.left} ticks left (${slot.ticks.time})`);
    }
    expect(document.querySelector("[data-deep-drain]")?.textContent).toContain("/ tick");
    expect(text()).toContain(DEEP_WORDS.rival);
  });

  it("offers one Join action and draws free slots as non-interactive indicators", () => {
    const onAct = vi.fn();
    const fixture = DEEP_SITE_CASES["Ethereal mine held by the player's Aspect, a free slot to join"];
    draw({ ...fixture, order: { kind: "act", verb: "join", onAct } });
    const [join] = labels(["Join"]);
    expect(join).toBeDefined();
    expect(document.querySelectorAll('button[data-deep-slot="empty"]')).toHaveLength(0);
    expect(document.querySelectorAll('span[data-deep-slot="empty"]')).toHaveLength(3);
    act(() => join!.click());
    expect(onAct).toHaveBeenCalledTimes(1);
    const filledTip = document.querySelector('[data-deep-slot="filled"]')?.getAttribute("data-tip") ?? "";
    expect(filledTip).toContain(DEEP_WORDS.share("100"));
  });

  it("reads per-guard drain from each slot and shows a range when a guard loses more per tick", () => {
    const fixture = DEEP_SITE_CASES["Foundation held, two slots filled"];
    const [first, second] = fixture.guard.slots;
    draw({
      ...fixture,
      guard: {
        ...fixture.guard,
        slots: [first!, { ...second!, lossPerTick: first!.lossPerTick + 150 }],
      },
    });
    expect(document.querySelector("[data-deep-drain]")?.textContent).toBe(
      `−${first!.lossPerTick}–${first!.lossPerTick + 150} / tick`,
    );
    const tips = [...document.querySelectorAll('[data-deep-slot="filled"]')].map(
      (slot) => slot.getAttribute("data-tip") ?? "",
    );
    expect(tips[0]).toContain(`−${first!.lossPerTick} / tick`);
    expect(tips[1]).toContain(`−${first!.lossPerTick + 150} / tick`);
  });

  it("renders facing portraits named by their sides, each before → after, stamina cost on Attack, and 4 guard slots", () => {
    const fixture = DEEP_SITE_CASES["Foundation held, two slots filled"];
    draw({
      ...fixture,
      fight: {
        army: 1_000,
        defender: 6_000,
        attackerTroops: { category: "Crossbowman", tier: "T1" },
        defenderTroops: { category: "Knight", tier: "T1" },
        result: { troopsLost: 330, guardLeft: 5_246 },
      },
      order: { kind: "act", verb: "attack", stamina: 30, onAct: () => {} },
    });
    const sides = [...document.querySelectorAll(".fight-side")];
    expect(sides).toHaveLength(2);
    expect(sides[0]!.querySelector('[data-icon="crossbowman-t1"]')).not.toBeNull();
    expect(sides[0]!.getAttribute("aria-label")).toBe("Army 1,000 → 670, −330 · 33% lost");
    expect(sides[0]!.textContent).toBe("1,000 → 670−330");
    expect(sides[1]!.querySelector('[data-icon="knight-t1"]')).not.toBeNull();
    expect(sides[1]!.getAttribute("aria-label")).toContain("Aldor 6,000 → 5,246");
    expect(document.querySelector("[data-attack-stamina='30']")).not.toBeNull();
    expect(document.querySelector("button[aria-label='Attack']")).not.toBeNull();
    expect(document.querySelectorAll("[data-deep-slot]")).toHaveLength(4);
  });
});
