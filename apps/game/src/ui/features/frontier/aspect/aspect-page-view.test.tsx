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
    expect(stages).toContainEqual(["Stage 3 of 5 · 5,200 of 10,000", 2]);
    expect(stages).toContainEqual(["Stage 1 of 5 · 900 of 10,000", 0]);
  });

  it("shows no unfunded LORDS figures on the Aspect race standings", () => {
    draw(ASPECT_PAGE_CASES["Mid-season, the player's Aspect second"]);
    expect(part("data-aspect-race")).not.toContain("LORDS");
    expect(document.body.textContent).not.toContain("10 / pt");
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
    expect(part("data-aspect-race")).toContain("Prowess finished 1st and won the season");
    const finished = document.body.querySelector('[data-aspect-race] .race-steps[aria-label^="Finished"]')!;
    expect([finished.getAttribute("aria-label"), finished.querySelectorAll("[data-built]").length]).toEqual([
      "Finished · 10,000 of 10,000",
      5,
    ]);
  });

  it("never prints a broken number in any scenario", () => {
    for (const props of Object.values(ASPECT_PAGE_CASES)) {
      draw(props);
      expect(document.body.textContent).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it("asks a player with no Aspect to join one, and says it is reading while the race is not settled", () => {
    draw(ASPECT_PAGE_CASES["No Aspect"]);
    expect(document.body.textContent).toContain("Join an Aspect to see its members");
    expect(document.body.querySelector("[data-aspect-own]")).toBeNull();
    draw(ASPECT_PAGE_CASES["Facts not settled"]);
    expect(document.body.textContent).toContain("Loading scores…");
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
    expect(part("data-aspect-members")).toContain("No Glory yet: it comes from holding Deep sites");
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
