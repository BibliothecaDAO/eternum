import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ASPECT_PAGE_CASES } from "./aspect-page-fixtures";
import { AspectPageView, type AspectPageProps } from "./aspect-page-view";
import { ASPECT_PAGE_WORDS } from "../../../design-system/kit/words";

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
const ownStages = () =>
  document.body.querySelector("[data-aspect-race] [data-own] .race-steps")?.getAttribute("aria-label") ?? "";

describe("the Aspect page", () => {
  it("ranks the four hyperstructures by height, each stage built lit among the five, the player's own selected", () => {
    draw(ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]);
    const race = part("data-aspect-race");
    expect(race.indexOf("Prowess")).toBeLessThan(race.indexOf("Luminary"));
    expect(race.indexOf("Luminary")).toBeLessThan(race.indexOf("Havoc"));
    expect(race.indexOf("Havoc")).toBeLessThan(race.indexOf("Insight"));
    const stages = [...document.body.querySelectorAll("[data-aspect-race] .race-steps")].map((row) => [
      row.getAttribute("aria-label"),
      row.querySelectorAll("[data-built]").length,
    ]);
    expect(stages).toContainEqual(["Stage 4 of 5 · 6,400 of 10,000", 3]);
    expect(stages).toContainEqual([
      "Stage 3 of 5 · 5,200 of 10,000 · Triumphs: Clear Mist day 12, Second Wind day 19, Pale Moon at stage 3, Spoils at stage 4",
      2,
    ]);
    expect(stages).toContainEqual(["Stage 1 of 5 · 900 of 10,000", 0]);
  });

  it("shows no unfunded LORDS figures on the Aspect race standings", () => {
    draw(ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]);
    expect(part("data-aspect-race")).not.toContain("LORDS");
    expect(document.body.textContent).not.toContain("10 / pt");
  });

  it("names the own Aspect's Triumphs on its stage bar: built stages with the day after the build, the rest with their stage", () => {
    draw(ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]);
    const triumphs = ownStages();
    expect(triumphs).toBe(
      "Stage 3 of 5 · 5,200 of 10,000 · Triumphs: Clear Mist day 12, Second Wind day 19, Pale Moon at stage 3, Spoils at stage 4",
    );
    expect(document.body.querySelectorAll("[data-aspect-race] .race-steps[aria-label*='Triumphs']")).toHaveLength(1);
  });

  it("shows the bane bar against its 1,500 and the members by Glory, one line each with its exact Glory", () => {
    draw(ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]);
    expect(part("data-aspect-bane")).toContain("300 of 1,500");
    const members = part("data-aspect-members");
    expect(members.indexOf("Aldor")).toBeLessThan(members.indexOf("Brek"));
    expect(
      [...document.body.querySelectorAll('[data-aspect-members] [role="img"][aria-label^="Glory "]')].map((glory) =>
        glory.getAttribute("aria-label"),
      ),
    ).toEqual(["Glory 1,240", "Glory 980", "Glory 710", "Glory 655", "Glory 310", "Glory 95"]);
  });

  it("names the Aspect that finished first once the age is won, and finished rows say so", () => {
    draw(ASPECT_PAGE_CASES["Age won by another Aspect"]);
    expect(part("data-aspect-race")).toContain(ASPECT_PAGE_WORDS.won("Prowess"));
    const finished = document.body.querySelector('[data-aspect-race] .race-steps[aria-label^="Finished"]')!;
    expect([finished.getAttribute("aria-label"), finished.querySelectorAll("[data-built]").length]).toEqual([
      "Finished · 10,000 of 10,000",
      5,
    ]);
    const triumphs = ownStages();
    expect(triumphs).toContain("Triumphs: Clear Mist day 12, Second Wind day 19, Pale Moon day 26, Spoils at stage 4");
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
    expect(ownStages()).toContain("Triumphs: Clear Mist day 12");
  });

  it("asks a player with no Aspect to join one, and says it is reading while the race is not settled", () => {
    draw(ASPECT_PAGE_CASES["No Aspect"]);
    expect(document.body.textContent).toContain(ASPECT_PAGE_WORDS.noAspect);
    expect(document.body.querySelector("[data-aspect-own]")).toBeNull();
    draw(ASPECT_PAGE_CASES["Facts not settled"]);
    expect(document.body.textContent).toContain(ASPECT_PAGE_WORDS.reading);
  });

  it("refuses Go to Deep with what opens the Deep while the realm cannot enter it", () => {
    draw({
      ...ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"],
      goToDeep: { refused: { reason: { kind: "failed", line: "Deep opens at Spire III" } } },
    });
    const verb = document.body.querySelector<HTMLButtonElement>('.ui-window__foot button[data-tone="bad"]')!;
    expect([verb.getAttribute("aria-label"), verb.textContent, verb.disabled]).toEqual([
      "Go to Deep",
      "Deep opens at Spire III",
      true,
    ]);
  });

  it("says in one line that no one holds Glory yet, over the members at 0", () => {
    const own = ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"].own!;
    draw({
      ...ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"],
      own: { ...own, members: own.members.map((member) => ({ ...member, glory: 0 })) },
    });
    expect(part("data-aspect-members")).toContain("No Glory yet — hold Deep sites");
    expect(document.body.querySelectorAll('[data-aspect-members] [aria-label="Glory 0"]')).toHaveLength(
      own.members.length,
    );
  });

  it("shows Go to Deep in the footer when reachable", () => {
    let deepClicked = 0;
    act(() =>
      root.render(
        <AspectPageView
          {...ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]}
          goToDeep={{
            go: () => {
              deepClicked += 1;
            },
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
            goToDeep={{
              go: () => {
                deepClicked += 1;
              },
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
