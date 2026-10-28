// @vitest-environment jsdom
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { buildStoryEventPresentation, configManager, siteDisplayName } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** The players the rows name, as the one name reader gives them. */
const DJIZUS = "0x510";
const KRUMP = "0x344";
/** A player whose name is also a word the Feed's sentences use. */
const ARMY = "0x777";
const NAMES: Record<string, string> = { [DJIZUS]: "djizus", [KRUMP]: "Krump", [ARMY]: "army" };
const nameOf = (address: string | bigint) => NAMES[`0x${BigInt(address).toString(16)}`];
const CAMP = 9001;

const game = vi.hoisted(() => ({ store: null as unknown as NativeFactStore }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: game.store } }) }));
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayerNames: () => ({ text: (address: string) => nameOf(address) ?? "?" }),
}));
// Where a row opens is the opener's, covered by its own tests (feed-row-line.test.tsx).
vi.mock("./story-feed-row", () => ({ useStoryOpener: () => null }));

const { FeedLine } = await import("./feed-line");

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  game.store = frontierDay().store;
  configManager.setActiveGame(1, 5);
  configManager.setStore(game.store);
  // A camp the player's army fights and finds, where the map keeps it.
  game.store.applyFacts([
    {
      model: "ExpeditionSite",
      key: "0x1:0x2329",
      value: {
        game_id: 1,
        entity_id: CAMP,
        category: StructureType.Camp,
        initial_guard_count: "1400000000000",
        alt: false,
        col: 2147483660,
        row: 2147483655,
        clear: null,
      },
    },
  ] as never);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

/** A story as the Feed receives it, worded by the game's one story formatter. */
const story = (owner: string, kind: string, payload: Record<string, unknown>): ProcessedStoryEvent =>
  ({
    id: `${kind}-${owner}`,
    event_id: `${kind}-${owner}`,
    story: kind,
    owner,
    timestampMs: 1_792_948_877_000,
    storyPayload: payload,
    presentation: buildStoryEventPresentation(
      { storyType: kind, storyPayload: payload, ownerAddress: owner, viewerAddress: DJIZUS, timestamp: 0 } as never,
      game.store,
      (address) => nameOf(address) ?? null,
    ),
  }) as unknown as ProcessedStoryEvent;

/** A reward of `units` of a resource, at the chain's precision. */
const scaled = (units: number) => String(BigInt(Math.round(units * 1_000_000_000)));

const draw = async (row: ProcessedStoryEvent, own = false) => {
  await act(async () => root.render(<FeedLine story={row} own={own} />));
  const line = host.querySelector("[data-feed-line]")!;
  return {
    words: line.querySelector(".ui-event__text")!.textContent,
    reward: line.querySelector(".ui-feed-line__reward")?.textContent ?? null,
    gold: line.querySelector("strong")?.className.includes("text-hud-gold") ?? null,
  };
};

it("writes an exploration under one unit as who explored, with no amount (owner: 'just write djizus explored')", async () => {
  const row = story(DJIZUS, "ExplorationReward", {
    explorer_id: 70,
    coord: { x: 2147483650, y: 2147483652, alt: false },
    resource_type: ResourcesIds.Labor,
    amount: scaled(0.4),
  });
  expect(row.presentation.title).not.toContain("<1");
  expect(await draw(row, true)).toEqual({ words: "djizus explored", reward: null, gold: true });
});

it("names who explored on every line, another player's too, and writes what it paid whole at its end", async () => {
  const row = story(KRUMP, "ExplorationReward", {
    explorer_id: 71,
    coord: { x: 2147483651, y: 2147483652, alt: false },
    resource_type: ResourcesIds.Essence,
    amount: scaled(646.7),
  });
  expect(await draw(row)).toEqual({ words: "Krump explored", reward: "+647", gold: false });
});

it("says a find by the site it found, with the guard's painting in the line", async () => {
  const row = story(DJIZUS, "ExplorationReward", {
    explorer_id: 70,
    coord: { x: 2147483660, y: 2147483655, alt: false },
    resource_type: ResourcesIds.Labor,
    amount: scaled(288),
  });
  const read = await draw(row, true);
  expect(read).toEqual({ words: `djizus found ${siteDisplayName(CAMP)}`, reward: "+288", gold: true });
  expect(host.querySelector(".ui-event__text .ui-feed-line__glyph")!.getAttribute("data-icon")).toMatch(/^beast-/);
});

it("reads a fight as its attacker's: who attacked what, and how it went", async () => {
  const row = story(DJIZUS, "BattleEvent", {
    attacker_id: 70,
    defender_id: CAMP,
    attacker: {
      player: DJIZUS,
      category: "Knight",
      tier: "T1",
      before: "7000000000000",
      after: "6500000000000",
      roll: 0,
    },
    defender: { player: "0x0", category: "Knight", tier: "T1", before: "1400000000000", after: "0", roll: 0 },
  });
  expect((await draw(row, true)).words).toBe(`djizus attacked ${siteDisplayName(CAMP)} · Victory`);
});

// The fight's result card is gone (owner, 27 October 2026): the Feed is where a player reads that an army was lost.
it("says a fight's army was lost", async () => {
  const row = story(DJIZUS, "BattleEvent", {
    attacker_id: 70,
    defender_id: CAMP,
    attacker: { player: DJIZUS, category: "Knight", tier: "T1", before: "154000000000", after: "0", roll: 0 },
    defender: {
      player: "0x0",
      category: "Knight",
      tier: "T1",
      before: "1100000000000",
      after: "1028000000000",
      roll: 0,
    },
  });
  expect((await draw(row, true)).words).toBe(`djizus attacked ${siteDisplayName(CAMP)} · Army lost`);
});

it("says what an army trained in the story's own words", async () => {
  const row = story(KRUMP, "TierBought", { explorer_id: 71, attribute: "Logistics", tier: 2, price: 100, kind: null });
  expect((await draw(row)).words).toBe("Krump trained Logistics uncommon");
  expect(host.querySelector(".ui-event__text .ui-feed-line__glyph")!.getAttribute("data-icon")).toBe("order-skill");
});

it("names who moved troops once, with how many moved (prod's day: 'Maelis Maelis moved 1,095 troops')", async () => {
  const row = story(KRUMP, "TroopsTransferred", {
    amount: "0xfef3160600",
    source: { Explorer: "0x1703b000000026" },
    target: { Explorer: "0x1703b00000002a" },
  });
  expect(await draw(row)).toEqual({ words: "Krump moved 1,095 troops", reward: null, gold: false });
});

/** Who a row names: each bold name in it. */
const named = () =>
  [...host.querySelectorAll("[data-feed-line] .ui-event__text strong")].map((name) => name.textContent);

it("leads a story's own words with who did it where they name no one (review: 'Crate opened' named no player)", async () => {
  const row = story(KRUMP, "RelicChestOpened", { explorer_id: 71, relics: [39], points: 0 });
  expect(row.presentation.title).toBe("Crate opened: 1 relic to the army");
  expect(await draw(row)).toEqual({ words: "Krump · Crate opened: 1 relic to the army", reward: null, gold: false });
  expect(named()).toEqual(["Krump"]);
});

it("leads with who did it where a word in the story's own words only reads like their name (review: a player named 'army')", async () => {
  const row = story(ARMY, "RelicChestOpened", { explorer_id: 71, relics: [39], points: 0 });
  expect(await draw(row)).toEqual({ words: "army · Crate opened: 1 relic to the army", reward: null, gold: false });
  expect(named()).toEqual(["army"]);
});

it("names the player once where a story's own words already name them, in gold when they are the player's", async () => {
  const row = story(DJIZUS, "RealmCreatedStory", { coord: { x: 2147483650, y: 2147483652, alt: false } });
  expect(row.presentation.title).toBe("djizus founded a realm");
  expect(await draw(row, true)).toEqual({ words: "djizus founded a realm", reward: null, gold: true });
  expect(named()).toEqual(["djizus"]);
});

it("names no one on a story no player owns", async () => {
  const row = story("0x0", "BlitzFinalized", {});
  expect(await draw(row)).toEqual({ words: "Blitz finalized", reward: null, gold: null });
});
