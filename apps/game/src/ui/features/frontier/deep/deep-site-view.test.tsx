import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEEP_BEASTS } from "@bibliothecadao/types";

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
const labels = (names: string[]) => buttons().filter((button) => names.includes(button.textContent ?? ""));

describe("a Deep site's card", () => {
  it("names the site, what a tick pays and the beast, and Attack sends", () => {
    const onAct = vi.fn();
    const props = DEEP_SITE_CASES["Foundation, today's beast, army in reach"];
    draw({ ...props, order: { kind: "act", verb: "attack", onAct } });
    expect(text()).toContain("Hyperstructure archive");
    expect(text()).toContain("6 Glory");
    expect(text()).toContain("+6 height to your Aspect's hyperstructure");
    expect(text()).toContain(`Today's beast: ${DEEP_BEASTS.foundation.name}, 10,000 troops`);
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
    expect(text()).toContain("Opens at 50 Realms today");
    expect(labels(["Attack"])).toHaveLength(0);
  });

  it("offers Move with its cost when the army is away", () => {
    const onMove = vi.fn();
    draw({ ...DEEP_SITE_CASES["Altar, open, army away"], order: { kind: "move", cost: "30 stamina", onMove } });
    expect(text()).toContain("No guard: the next army takes it");
    expect(text()).toContain("1,500");
    act(() => labels(["Move"])[0]!.click());
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("lists a held site's four slots from the top, marks the one fought next and leaves free slots free", () => {
    const fixture = DEEP_SITE_CASES["Foundation held, two slots filled"];
    draw(fixture);
    expect(text()).toContain("Held by Prowess");
    const rows = document.querySelector("[data-deep-slots]")!.textContent!;
    expect(rows.indexOf("Aldor · fought next")).toBeGreaterThan(-1);
    expect(rows.indexOf("Aldor")).toBeLessThan(rows.indexOf("Brek"));
    expect(rows.match(/Free slot/g)).toHaveLength(2);
    for (const slot of fixture.guard.slots) {
      expect(rows).toContain(`${slot.ticks.left} ticks left (${slot.ticks.time})`);
    }
    expect(rows).toContain("75% of each tick");
    expect(rows).toContain("25% of each tick");
    expect(text()).toContain("Another Aspect holds it");
  });

  it("offers Join on a free slot of the player's own Aspect", () => {
    const fixture = DEEP_SITE_CASES["Ethereal mine held by the player's Aspect, a free slot to join"];
    draw(fixture);
    expect(labels(["Join"])).toHaveLength(1);
    for (const slot of fixture.guard.slots) {
      expect(text()).toContain(`${slot.ticks.left} ticks left (${slot.ticks.time})`);
    }
    expect(text()).toContain("100% of each tick");
  });
});
