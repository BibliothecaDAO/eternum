import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ASPECT_PAGE_CASES } from "./aspect-page-fixtures";
import { AspectPageView, type AspectPageProps } from "./aspect-page-view";

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

const draw = (props: Omit<AspectPageProps, "onClose">) =>
  act(() => root.render(<AspectPageView {...props} onClose={() => {}} />));
const part = (name: string) => document.body.querySelector(`[${name}]`)?.textContent ?? "";

describe("the Aspect page", () => {
  it("ranks the four hyperstructures by height with their stage, the player's own selected", () => {
    draw(ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]);
    const race = part("data-aspect-race");
    expect(race.indexOf("Might")).toBeLessThan(race.indexOf("Harmony"));
    expect(race.indexOf("Harmony")).toBeLessThan(race.indexOf("Chaos"));
    expect(race.indexOf("Chaos")).toBeLessThan(race.indexOf("Guile"));
    expect(race).toContain("Stage 4 of 5 · 6,400 of 10,000");
    expect(race).toContain("Stage 3 of 5 · 5,200 of 10,000");
    expect(race).toContain("Stage 1 of 5 · 900 of 10,000");
  });

  it("shows the Triumphs of built stages with the day after the build, and the rest with their stage", () => {
    draw(ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]);
    const triumphs = part("data-aspect-triumphs");
    expect(triumphs).toContain("Clear Mist · day 12");
    expect(triumphs).toContain("Second Wind · day 19");
    expect(triumphs).toContain("Pale Moon · at stage 3");
    expect(triumphs).toContain("Spoils · at stage 4");
  });

  it("shows the bane bar against its 1,500 and the members by Glory with the site each guards", () => {
    draw(ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]);
    expect(part("data-aspect-bane")).toContain("300 of 1,500");
    const members = part("data-aspect-members");
    expect(members.indexOf("Aldor")).toBeLessThan(members.indexOf("Brek"));
    expect(members).toContain("Guards the Foundation");
    expect(members).toContain("Guards the Altar");
    expect(members).toContain("Guards the Quarry");
    expect(members).toContain("1.2K");
  });

  it("names the Aspect that finished first once the age is won, and finished rows say so", () => {
    draw(ASPECT_PAGE_CASES["Age won by another Aspect"]);
    expect(part("data-aspect-race")).toContain("Might finished first and won the age");
    expect(part("data-aspect-race")).toContain("Finished · 10,000 of 10,000");
    expect(part("data-aspect-triumphs")).toContain("Pale Moon · day");
  });

  it("asks a player with no Aspect to join one, and says it is reading while the race is not settled", () => {
    draw(ASPECT_PAGE_CASES["No Aspect"]);
    expect(document.body.textContent).toContain("Join an Aspect to see its members");
    expect(document.body.querySelector("[data-aspect-own]")).toBeNull();
    draw(ASPECT_PAGE_CASES["Facts not settled"]);
    expect(document.body.textContent).toContain("Reading the race…");
  });
});
