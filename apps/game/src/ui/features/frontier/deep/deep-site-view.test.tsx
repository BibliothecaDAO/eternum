import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    expect(text()).toContain("Foundation");
    expect(text()).toContain("5 Glory");
    expect(text()).toContain("+5 height to your Aspect's hyperstructure");
    expect(text()).toContain("Today's beast: 10,000 troops");
    const [attack] = labels(["Attack"]);
    act(() => attack!.click());
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("holds Attack disabled and says why when the stamina is short", () => {
    draw(DEEP_SITE_CASES["Quarry, army short of stamina"]);
    expect(labels(["Attack"])[0]!.disabled).toBe(true);
    expect(text()).toContain("Needs 30 stamina, holds 12");
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
    draw(DEEP_SITE_CASES["Foundation held, two slots filled"]);
    expect(text()).toContain("Held by Might");
    const rows = document.querySelector("[data-deep-slots]")!.textContent!;
    expect(rows.indexOf("Aldor · fought next")).toBeGreaterThan(-1);
    expect(rows.indexOf("Aldor")).toBeLessThan(rows.indexOf("Brek"));
    expect(rows.match(/Free slot/g)).toHaveLength(2);
    // 6,000 troops at 200 a tick last 30 ticks of 120 seconds; 2,000 last 10.
    expect(rows).toContain("30 ticks left (1h)");
    expect(rows).toContain("10 ticks left (20m)");
    expect(rows).toContain("75% of each tick");
    expect(rows).toContain("25% of each tick");
    expect(text()).toContain("Another Aspect holds it");
  });

  it("offers Join on a free slot of the player's own Aspect", () => {
    draw(DEEP_SITE_CASES["Quarry held by the player's Aspect, a free slot to join"]);
    expect(labels(["Join"])).toHaveLength(1);
    expect(text()).toContain("20 ticks left (40m)");
    expect(text()).toContain("100% of each tick");
  });
});
