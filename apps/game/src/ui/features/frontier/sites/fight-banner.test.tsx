import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { configManager, setBlockTimestampSource, siteDisplayName } from "@bibliothecadao/eternum";
import { formatShort, ResourcesIds } from "@bibliothecadao/types";
import { GameProvider } from "@/hooks/context/game-context";
import { FIGHT_RESULT } from "@/ui/design-system/kit/words";
import { FightBanner, showClearBanner } from "./fight-banner";
import type { SiteClear } from "./site-outcome";

const NOW = 1_000;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  setBlockTimestampSource(() => NOW);
  vi.spyOn(configManager, "getTick").mockReturnValue(60);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store: { get: () => undefined } } as never} account={{} as never}>
        <FightBanner />
      </GameProvider>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

const SITE = 7;
const clearOf = (reward: SiteClear["reward"], troopsLost: number): SiteClear => ({
  siteId: SITE,
  kind: "Camp",
  reward,
  troopsLost,
});
const shown = (clear: SiteClear) => {
  act(() => showClearBanner(clear));
  return host.querySelector<HTMLButtonElement>("[data-fight-banner]");
};
const chips = () => [...host.querySelectorAll(".fight-banner__chips .ui-chip")];

it("crowns the clear inside the card: Victory, then the site it cleared, its name in bold", () => {
  const banner = shown(clearOf({ resourceId: ResourcesIds.Wood, amount: 1_200 }, 180))!;
  expect(banner.querySelector(".fight-banner__top .fight-banner__crest")).not.toBeNull();
  expect(banner.querySelector(".fight-banner__word")?.textContent).toBe(FIGHT_RESULT.victory);
  expect(banner.querySelector(".fight-banner__site")?.textContent).toBe(
    `${siteDisplayName(SITE)} ${FIGHT_RESULT.cleared}`,
  );
  expect(banner.querySelector(".fight-banner__site > b")?.textContent).toBe(siteDisplayName(SITE));
});

it("puts the reward in green and the troops lost in red on its outcome bar, and no loss chip when none were lost", () => {
  shown(clearOf({ resourceId: ResourcesIds.Wood, amount: 1_200 }, 180));
  expect(chips().map((chip) => [chip.getAttribute("data-tone"), chip.textContent])).toEqual([
    ["good", formatShort(1_200, { signed: true })],
    ["bad", formatShort(-180, { signed: true })],
  ]);
  shown(clearOf({ resourceId: ResourcesIds.Wood, amount: 450 }, 0));
  expect(chips().map((chip) => chip.getAttribute("data-tone"))).toEqual(["good"]);
});

it("draws no outcome bar for a clear that paid nothing and cost nothing", () => {
  shown(clearOf(null, 0));
  expect(host.querySelector(".fight-banner__chips")).toBeNull();
});

it("leaves at a press anywhere on it", () => {
  const banner = shown(clearOf(null, 0))!;
  act(() => banner.click());
  expect(host.querySelector("[data-fight-banner]")).toBeNull();
});
