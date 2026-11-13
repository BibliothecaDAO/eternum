import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { configManager } from "@bibliothecadao/eternum";

import { deepSitesScenario } from "@/lab/game/deep-sites-scenario";
import { chainOf } from "@/lab/game/lab-chain";
import { AspectPage } from "./aspect-page";
import { readAspectPage } from "./aspect-page-plan";

/** The lab's Deep game: Chaos ahead at stage 3, the player's Might at stage 2 with its first Triumph, Chaos's bar part filled. */
const lab = () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  const scenario = deepSitesScenario();
  return { chain: chainOf(scenario), player: BigInt(scenario.player), now: scenario.startsAt };
};

it("ranks the four hyperstructures as the contract does, each with its height and stage", () => {
  const { chain, player, now } = lab();
  const page = readAspectPage(chain, 1, 7n, player, now);
  if (page?.kind !== "page") throw new Error("no Aspect page");
  expect(page.race.standings.map(({ aspect, rank, height, stage }) => ({ aspect, rank, height, stage }))).toEqual([
    { aspect: 3, rank: 1, height: 6_000, stage: 3 },
    { aspect: 1, rank: 2, height: 4_100, stage: 2 },
    { aspect: 2, rank: 3, height: 1_500, stage: 0 },
    { aspect: 4, rank: 4, height: 0, stage: 0 },
  ]);
});

it("reads the player's Aspect: its Triumphs, its bane bar and its members by Glory with the site each guards", () => {
  const { chain, player, now } = lab();
  const page = readAspectPage(chain, 1, 7n, player, now);
  if (page?.kind !== "page" || !page.own) throw new Error("no own Aspect");
  expect(page.own.aspect).toBe(1);
  expect(page.own.triumphs.map(({ stage, day }) => ({ stage, fell: day !== null }))).toEqual([
    { stage: 1, fell: true },
    { stage: 2, fell: false },
    { stage: 3, fell: false },
    { stage: 4, fell: false },
  ]);
  // Might has not held the Altar: its bar is zero, as AltarBar declares; Chaos's 600 is not the player's.
  expect(page.own.bar).toEqual({ charge: 0, threshold: 1_500 });
  expect(page.own.members.map(({ glory, guards, mine }) => ({ glory, guards, mine }))).toEqual([
    { glory: 340, guards: "Foundation", mine: false },
    { glory: 120, guards: null, mine: true },
  ]);
});

it("reads nothing while the snapshot is still arriving, when an absent Glory or bar proves nothing", () => {
  const { chain, player, now } = lab();
  chain.setSnapshot({ gameId: 1, complete: false, actor: String(player), timestamp: now });
  expect(readAspectPage(chain, 1, 7n, player, now)).toEqual({ kind: "reading" });
});

it("shows the race alone to a viewer in no Aspect, and no page in a game with no race", () => {
  const { chain, player, now } = lab();
  const page = readAspectPage(chain, 1, null, player, now);
  expect(page).toMatchObject({ kind: "page", own: null });
  const [rulesKey] = [...chain.entries("RaceRules")][0]!;
  chain.applyFacts([{ model: "RaceRules", key: rulesKey, value: null }] as never);
  expect(readAspectPage(chain, 1, 7n, player, now)).toBeNull();
});

it("draws the board, the player's Aspect and its members on the page", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { chain, player, now } = lab();
  const page = readAspectPage(chain, 1, 7n, player, now)!;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<AspectPage plan={page} onClose={() => {}} />));
  const rows = [...host.querySelectorAll("[data-aspect-race] .ui-row")].map((row) => row.textContent);
  expect(rows).toEqual([
    "1ChaosStage 3 of 5 · 6,000 of 10,000",
    "2MightStage 2 of 5 · 4,100 of 10,000",
    "3HarmonyStage 0 of 5 · 1,500 of 10,000",
    "4GuileStage 0 of 5 · 0 of 10,000",
  ]);
  expect(host.textContent).toContain("Your Aspect: Might");
  expect(host.querySelector("[data-aspect-triumphs]")?.textContent).toContain("Clear Mist · day");
  expect(host.querySelector("[data-aspect-triumphs]")?.textContent).toContain("Spoils · at stage 4");
  expect(host.querySelector("[data-aspect-bane]")?.textContent).toBe("Bane bar: 0 of 1,500");
  expect(host.querySelectorAll("[data-aspect-members] .ui-row")).toHaveLength(2);
  expect(host.querySelector("[data-aspect-members]")?.textContent).toContain("Guards the Foundation");
  act(() => root.unmount());
});
