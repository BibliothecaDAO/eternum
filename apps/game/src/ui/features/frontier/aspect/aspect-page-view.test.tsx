import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deepSites } from "@bibliothecadao/types";
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
    expect(race.indexOf("Prowess")).toBeLessThan(race.indexOf("Luminary"));
    expect(race.indexOf("Luminary")).toBeLessThan(race.indexOf("Havoc"));
    expect(race.indexOf("Havoc")).toBeLessThan(race.indexOf("Insight"));
    expect(race).toContain("Stage 4 of 5 · 6,400 of 10,000");
    expect(race).toContain("Stage 3 of 5 · 5,200 of 10,000");
    expect(race).toContain("Stage 1 of 5 · 900 of 10,000");
  });

  it("shows no unfunded LORDS figures on the Aspect race standings", () => {
    draw(ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]);
    expect(part("data-aspect-race")).not.toContain("LORDS");
    expect(document.body.textContent).not.toContain("10 / pt");
  });

  it("shows the Triumphs of built stages with the day after the build, and the rest with their stage", () => {
    draw(ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]);
    const triumphs = part("data-aspect-triumphs");
    expect(triumphs).toContain("Clear Mist · day 12");
    expect(triumphs).toContain("Second Wind · day 19");
    expect(triumphs).not.toContain("day 26");
    expect(triumphs).toContain("Pale Moon · at stage 3");
    expect(triumphs).toContain("Spoils · at stage 4");
  });

  it("shows the bane bar against its 1,500 and the members by Glory with the site each guards", () => {
    draw(ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]);
    expect(part("data-aspect-bane")).toContain("300 of 1,500");
    const members = part("data-aspect-members");
    expect(members.indexOf("Aldor")).toBeLessThan(members.indexOf("Brek"));
    for (const { name } of deepSites) expect(members).toContain(`Guards the ${name}`);
    expect(members).toContain("1.2K");
  });

  it("names the Aspect that finished first once the age is won, and finished rows say so", () => {
    draw(ASPECT_PAGE_CASES["Age won by another Aspect"]);
    expect(part("data-aspect-race")).toContain("Prowess finished 1st and won the season");
    expect(part("data-aspect-race")).toContain("Finished · 10,000 of 10,000");
    const triumphs = part("data-aspect-triumphs");
    expect(triumphs).toContain("Clear Mist · day 12");
    expect(triumphs).toContain("Second Wind · day 19");
    expect(triumphs).toContain("Pale Moon · day 26");
    expect(triumphs).toContain("Spoils · at stage 4");
  });

  it("gives every built stage a known, finite day in every scenario, and never prints a broken one", () => {
    for (const props of Object.values(ASPECT_PAGE_CASES)) {
      draw(props);
      expect(document.body.textContent).not.toMatch(/NaN|undefined|Infinity/);
      const height = props.race?.standings.find((each) => each.own)?.height ?? 0;
      for (const { stage, day } of props.own?.triumphs ?? []) {
        // a stage's Triumph has a day exactly when its 2,000-high stage is built
        if (height >= stage * 2_000) expect(Number.isInteger(day)).toBe(true);
        else expect(day).toBeNull();
      }
    }
  });

  it("shows the day it is given, unchanged", () => {
    const own = ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"].own;
    draw({
      ...ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"],
      own: { ...own, triumphs: [{ stage: 1, day: 12 }] },
    });
    expect(part("data-aspect-triumphs")).toContain("Clear Mist · day 12");
  });

  it("asks a player with no Aspect to join one, and says it is reading while the race is not settled", () => {
    draw(ASPECT_PAGE_CASES["No Aspect"]);
    expect(document.body.textContent).toContain("Join an Aspect to see its members");
    expect(document.body.querySelector("[data-aspect-own]")).toBeNull();
    draw(ASPECT_PAGE_CASES["Facts not settled"]);
    expect(document.body.textContent).toContain("Loading scores…");
  });

  it("shows Go to Deep in the footer when reachable", () => {
    let deepClicked = 0;
    act(() =>
      root.render(
        <AspectPageView
          {...ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]}
          onGoToDeep={() => {
            deepClicked += 1;
          }}
          onClose={() => {}}
        />,
      ),
    );
    const buttons = [...document.body.querySelectorAll("button")];
    const goDeep = buttons.find((button) => button.textContent?.includes("Go to Deep"));
    expect(goDeep).toBeDefined();
    act(() => goDeep!.click());
    expect(deepClicked).toBe(1);

    for (const endedOrNoAspect of [
      ASPECT_PAGE_CASES["Age won by another Aspect"],
      ASPECT_PAGE_CASES["No Aspect"],
      ASPECT_PAGE_CASES["Facts not settled"],
    ]) {
      act(() =>
        root.render(
          <AspectPageView
            {...endedOrNoAspect}
            onGoToDeep={() => {
              deepClicked += 1;
            }}
            onClose={() => {}}
          />,
        ),
      );
      expect(
        [...document.body.querySelectorAll("button")].find((button) => button.textContent?.includes("Go to Deep")),
      ).toBeUndefined();
    }
  });
});
