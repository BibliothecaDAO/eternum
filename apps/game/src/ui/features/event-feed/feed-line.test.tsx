// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import {
  buildStoryEventPresentation,
  configManager,
  expeditionDepth,
  frontierBeast,
  readExpeditionRules,
  siteDisplayName,
} from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** The players the rows name, as the one name reader gives them. */
const DJIZUS = "0x510";
const KRUMP = "0x344";
const NAMES: Record<string, string> = { [DJIZUS]: "djizus", [KRUMP]: "Krump" };
const nameOf = (address: string | bigint) => NAMES[`0x${BigInt(address).toString(16)}`];
const CAMP = 9001;
const STORY_AT = 1_792_948_877;

const game = vi.hoisted(() => ({ store: null as unknown as NativeFactStore }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: game.store } }) }));
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayerNames: () => ({ text: (address: string) => nameOf(address) ?? "?" }),
}));
// Where a row opens is the opener's, covered by its own tests (feed-row-line.test.tsx).
vi.mock("./story-feed-row", () => ({ useStoryOpener: () => null }));
// Herald, as the game's shard names it; its answers are the `fetch` each test serves.
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1" }) }));
vi.mock("@bibliothecadao/eternum/game-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/game-client")>()),
  requireShard: () => ({ url: "http://herald.test", chainId: "0x1", worldAddress: "0xabc" }),
}));

const { FeedLine, FeedRuleLine } = await import("./feed-line");
const { useAccountStore } = await import("@/hooks/store/use-account-store");
const { useChainTimeStore } = await import("@/hooks/store/use-chain-time-store");

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  useAccountStore.setState({ account: { address: DJIZUS } as never });
  useChainTimeStore.getState().anchor({ timestamp: (STORY_AT + 2 * 60) * 1_000 });
  game.store = frontierDay().store;
  configManager.setActiveGame(1);
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
  queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  herald.clear();
  vi.stubGlobal("fetch", async (address: string) => {
    const site = herald.get(Number(/\/games\/1\/sites\/(\d+)$/.exec(address)?.[1]));
    return site
      ? new Response(JSON.stringify(site))
      : new Response(JSON.stringify({ error: "unknown_site" }), { status: 404 });
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

let queries: QueryClient;
/** The sites Herald holds by entity, as it serves them: every scalar in hex, the way its fold writes rows. */
const herald = new Map<number, Record<string, unknown>>();

/** A story as the Feed receives it, worded by the game's one story formatter. */
const story = (owner: string, kind: string, payload: Record<string, unknown>): ProcessedStoryEvent =>
  ({
    id: `${kind}-${owner}`,
    event_id: `${kind}-${owner}`,
    story: kind,
    owner,
    participants: [owner],
    timestampMs: STORY_AT * 1_000,
    storyPayload: payload,
    presentation: buildStoryEventPresentation(
      { storyType: kind, storyPayload: payload, ownerAddress: owner, viewerAddress: DJIZUS, timestamp: 0 } as never,
      game.store,
      (address) => nameOf(address) ?? null,
    ),
  }) as unknown as ProcessedStoryEvent;

/** A reward of `units` of a resource, at the chain's precision. */
const scaled = (units: number) => String(BigInt(Math.round(units * 1_000_000_000)));

const draw = async (row: ProcessedStoryEvent, Line = FeedLine) => {
  await act(async () =>
    root.render(
      <QueryClientProvider client={queries}>
        <Line story={row} />
      </QueryClientProvider>,
    ),
  );
  // Herald's answer for a site the map does not hold.
  await act(async () => new Promise((settled) => setTimeout(settled, 0)));
  const line = host.querySelector("[data-feed-line]")!;
  return {
    words: line.querySelector(".ui-event__text")!.textContent,
    reward: line.querySelector(".ui-feed-line__reward")?.textContent ?? null,
    // The player's own row is gold as a whole (owner, 27 October: "put the row in yellow like it did before").
    gold: line.hasAttribute("data-own"),
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
  expect(await draw(row)).toEqual({ words: "djizus explored", reward: null, gold: true });
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
  const read = await draw(row);
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
  expect((await draw(row)).words).toBe(`djizus attacked ${siteDisplayName(CAMP)} · Victory`);
  // The playtest runner counts a Feed's rows by their story (scripts/client-playtest/steps.mjs, feed-after-the-clear).
  expect(host.querySelector("[data-feed-line]")?.getAttribute("data-story")).toBe("BattleEvent");
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
  expect((await draw(row)).words).toBe(`djizus attacked ${siteDisplayName(CAMP)} · Army lost`);
});

it("marks each ruled row with who it concerns, the player's own fights by how they went, and says how long ago it was", async () => {
  const fight = (attacker: string, armyAfter: string, guardAfter: string) =>
    story(attacker, "BattleEvent", {
      attacker_id: 70,
      defender_id: CAMP,
      attacker: {
        player: attacker,
        category: "Knight",
        tier: "T1",
        before: "7000000000000",
        after: armyAfter,
        roll: 0,
      },
      defender: { player: "0x0", category: "Knight", tier: "T1", before: "1400000000000", after: guardAfter, roll: 0 },
    });
  const rule = async (row: ProcessedStoryEvent) => {
    await draw(row, FeedRuleLine);
    const line = host.querySelector("[data-feed-line]")!;
    return [line.getAttribute("data-rule"), line.querySelector(".ui-event__time")!.textContent];
  };
  expect(await rule(fight(DJIZUS, "6500000000000", "0"))).toEqual(["good", "2m"]);
  expect(await rule(fight(DJIZUS, "0", "1028000000000"))).toEqual(["bad", "2m"]);
  expect(await rule(fight(KRUMP, "6500000000000", "0"))).toEqual(["world", "2m"]);
  expect(
    await rule(story(DJIZUS, "TierBought", { explorer_id: 70, attribute: "Logistics", tier: 3, price: 400 })),
  ).toEqual(["own", "2m"]);
});

/** A fight on the camp's site, the attacker's army lost to its guard. */
const fightAt = (site: number) =>
  story(KRUMP, "BattleEvent", {
    attacker_id: 71,
    defender_id: site,
    attacker: { player: KRUMP, category: "Knight", tier: "T1", before: "300000000000", after: "0", roll: 0 },
    defender: {
      player: "0x0",
      category: "Knight",
      tier: "T1",
      before: "1100000000000",
      after: "1000000000000",
      roll: 0,
    },
  });
const paintings = () =>
  [...host.querySelectorAll("[data-feed-line] [data-icon]")].map((icon) => icon.getAttribute("data-icon"));

/** The depth of the camp's row, with its beast bounds, which tell a roaming beast's two strengths apart. */
const depthWithBounds = () => {
  const site = game.store.require("ExpeditionSite", { game_id: 1, entity_id: CAMP });
  const depth = expeditionDepth(readExpeditionRules(game.store, 1)!, { y: site.row });
  game.store.applyFacts([
    {
      model: "DepthRules",
      key: "0x777",
      value: {
        game_id: 1,
        depth,
        beast_weak_lower: 300,
        beast_weak_upper: 350,
        beast_strong_lower: 450,
        beast_strong_upper: 550,
        site_guard_lower: 1000,
        site_guard_upper: 1600,
        rift_guard_lower: 1000,
        rift_guard_upper: 1600,
        reveal_site_neighbors: false,
        reveal_percent: 10,
        chest: { common: 5000, uncommon: 2700, rare: 1400, epic: 600, legendary: 300 },
        guard_step: 100,
      },
    },
  ] as never);
  return { site, depth };
};
/** Every kind of site the game guards, by its starting guard, and the beast the map paints for it at that depth. */
const guardsAt = (depth: number) =>
  [
    [StructureType.Camp, 1_400, `beast-${frontierBeast(depth, StructureType.Camp).beast}`],
    [StructureType.Rift, 1_400, `beast-${frontierBeast(depth, StructureType.Rift).beast}`],
    [StructureType.Beasts, 320, `beast-${frontierBeast(depth, StructureType.Beasts, "lowly").beast}`],
    [StructureType.Beasts, 500, `beast-${frontierBeast(depth, StructureType.Beasts, "stronger").beast}`],
    [StructureType.Ruin, 3_000, `beast-${frontierBeast(depth).beast}`],
  ] as const;
const hex = (value: number | bigint | string) => `0x${BigInt(value).toString(16)}`;

it("draws the guard a fight was against as the map draws it, for every kind of site the game guards", async () => {
  const { site, depth } = depthWithBounds();
  for (const [category, guard, painting] of guardsAt(depth)) {
    game.store.applyFacts([
      {
        model: "ExpeditionSite",
        key: "0x1:0x2329",
        value: { ...site, category, initial_guard_count: scaled(guard) },
      },
    ] as never);
    await draw(fightAt(CAMP));
    expect(paintings()).toEqual(["attack", painting]);
  }
});

// The owner, 28 October 2026: "the icons in the chat arent the new ones ?" ("Loaf attacked Runegrasp · Army lost").
it("draws the guard of a fight far from the player's armies from Herald's row of that site, for every kind", async () => {
  const { site, depth } = depthWithBounds();
  for (const [index, [category, guard, painting]] of guardsAt(depth).entries()) {
    const far = 4_242 + index;
    herald.set(far, {
      game_id: "0x1",
      entity_id: hex(far),
      category: hex(category),
      initial_guard_count: hex(scaled(guard)),
      alt: false,
      col: hex(site.col + 40),
      row: hex(site.row),
      clear: null,
    });
    const read = await draw(fightAt(far));
    expect(read.words).toBe(`Krump attacked ${siteDisplayName(far)} · Army lost`);
    expect(paintings()).toEqual(["attack", painting]);
  }
});

it("keeps a site's guard once the player's map lets the site go, as when their army leaves its region", async () => {
  const { site } = depthWithBounds();
  herald.set(CAMP, {
    game_id: "0x1",
    entity_id: hex(CAMP),
    category: hex(site.category),
    initial_guard_count: hex(site.initial_guard_count),
    alt: false,
    col: hex(site.col),
    row: hex(site.row),
    clear: null,
  });
  await draw(fightAt(CAMP));
  expect(paintings()).toEqual(["attack", "beast-golem"]);
  await act(async () => game.store.applyFacts([{ model: "ExpeditionSite", key: "0x1:0x2329", value: null }] as never));
  await act(async () => new Promise((settled) => setTimeout(settled, 0)));
  expect(game.store.get("ExpeditionSite", { game_id: 1, entity_id: CAMP })).toBeUndefined();
  expect(paintings()).toEqual(["attack", "beast-golem"]);
});

it("reads a clear's credited resources near or far without retired progression rewards", async () => {
  const clear = (site: number, xp?: number) =>
    story(DJIZUS, "SitePayout", {
      xp,
      site_id: site,
      category: StructureType.Camp,
      reward: { resource_type: ResourcesIds.Labor, amount: scaled(700) },
    });
  const xps = () =>
    [...host.querySelectorAll("[data-feed-line] .ui-feed-line__reward")].map((each) => each.textContent);
  // The camp the map holds: 1,400 guards at the start pay floor(sqrt(25 × 1,400) / 2) = 93 base XP, scaled by Ethereal I to 139.
  const near = game.store.require("ExpeditionSite", { game_id: 1, entity_id: CAMP });
  const read = await draw(clear(CAMP, 139));
  expect(read.words).toBe(`djizus cleared ${siteDisplayName(CAMP)}`);
  expect(xps()).toEqual(["+700"]);
  // One the map does not hold, from Herald's row of that site.
  const far = 4_400;
  herald.set(far, {
    game_id: "0x1",
    entity_id: hex(far),
    category: hex(StructureType.Rift),
    initial_guard_count: hex(scaled(1_200)),
    alt: false,
    col: hex(near.col + 40),
    row: hex(near.row),
    clear: null,
  });
  await draw(clear(far, 129));
  expect(xps()).toEqual(["+700"]);
  // Neither holds it: what it paid alone, never a guessed XP.
  await draw(clear(4_401));
  expect(xps()).toEqual(["+700"]);
});

it("draws no guard, never an old or guessed one, for a site neither the map nor Herald holds", async () => {
  await draw(fightAt(4_300));
  expect(paintings()).toEqual(["attack"]);
});

/** The gems a row draws in its words, each by its name and size (owner, 3 November 2026: the Feed keeps its alignment). */
const gems = () =>
  [...host.querySelectorAll("[data-feed-line] .ui-event__text .ui-tier")].map((gem) => [
    gem.getAttribute("aria-label"),
    gem.getAttribute("data-size"),
  ]);

it("reads a historical skill purchase through the story formatter", async () => {
  const row = story(KRUMP, "SkillPointSpent", {
    explorer_id: 71,
    choice: "Battle",
    tier: 4,
    point_rank: 4,
    stamina: 30,
  });
  expect((await draw(row)).words).toBe("Krump · Battle IV");
  expect(gems()).toEqual([["IV", "line"]]);
});

it("draws a tier bought and a Shrine's point in the story's own words, each rank as its gem", async () => {
  expect(
    (await draw(story(KRUMP, "TierBought", { explorer_id: 71, attribute: "Logistics", tier: 3, price: 400 }))).words,
  ).toBe("Krump · Logistics III");
  expect(gems()).toEqual([["III", "line"]]);
  const shrine = story(KRUMP, "SiteUsed", { explorer_id: 71, coord: { x: 3, y: 4 }, benefit: { ShrinePoint: 2 } });
  expect((await draw(shrine)).words).toBe("Krump · Shrine used, II +1");
  expect(gems()).toEqual([["II", "line"]]);
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

it("leads a story's own words with who did it where they name no one", async () => {
  const row = story(KRUMP, "BankLiquidity", { resource_type: 23, add: true });
  expect(row.presentation.title).toBe("Liquidity added");
  expect(await draw(row)).toEqual({ words: "Krump · Liquidity added", reward: null, gold: false });
  expect(named()).toEqual(["Krump"]);
});

it("names the player once where a story's own words already name them, in gold when they are the player's", async () => {
  const row = story(DJIZUS, "RealmCreatedStory", { coord: { x: 2147483650, y: 2147483652, alt: false } });
  expect(row.presentation.title).toBe("djizus created a Realm");
  expect(await draw(row)).toEqual({ words: "djizus created a Realm", reward: null, gold: true });
  expect(named()).toEqual(["djizus"]);
});

it("names no one on a story no player owns", async () => {
  const row = story("0x0", "BlitzFinalized", {});
  expect(await draw(row)).toEqual({ words: "Blitz finalized", reward: null, gold: false });
});
