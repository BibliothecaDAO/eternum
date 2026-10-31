import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";

/** The game as a row reads it: the armies that stand and the view the player is in. */
const game = vi.hoisted(() => ({
  armies: new Set<number>(),
  mapView: true,
  navigate: vi.fn(),
  selectArmy: vi.fn(),
  goToStructure: vi.fn(),
}));

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: {
        // Every army here calls realm 5 home.
        get: (model: string, key: { explorer_id?: number; entity_id?: number }) =>
          model === "ExplorerTroops" && game.armies.has(Number(key.explorer_id))
            ? { explorer_id: key.explorer_id, owner: 5n }
            : model === "Structure" && Number(key.entity_id) === 5
              ? { entity_id: 5n }
              : undefined,
      },
    },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0, useNativeRow: () => undefined }));
vi.mock("@/play/navigation/open-place", async (original) => ({
  ...(await original<typeof import("@/play/navigation/open-place")>()),
  openOnMap: game.navigate,
}));
vi.mock("@/hooks/helpers/use-navigate", () => ({
  useGoToStructure: () => game.goToStructure,
  useSelectArmyOnMap: () => game.selectArmy,
}));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: game.mapView }) }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: {
    getActiveGameId: () => 1,
    getVictoryPointGrants: () => ({
      exploreTile: 5,
      openRelicCrate: 250,
      claimCampFromBandits: 250,
      claimHyperstructureFromBandits: 1000,
    }),
  },
  entityMapPosition: () => ({ x: 50, y: 60 }),
  structureMapPosition: (_store: unknown, structure: { entity_id: bigint }) =>
    structure.entity_id === 5n ? { x: 70, y: 80 } : null,
}));

import { FeedRowLine } from "./feed-row-line";
import { eventsReads, selectEventStories } from "./event-stories";
import { StoryFeedRow } from "./story-feed-row";
import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
import { relicChestRelics } from "@bibliothecadao/types";

const PLAYER = "0x1";
const story = (id: string, kind: string, owner: string, payload: Record<string, unknown>, title: string) =>
  ({
    id,
    event_id: id,
    story: kind,
    owner,
    participants: [owner],
    tx_hash: `0x${id}`,
    // Its subject: the structure a capture took, here one for every story.
    entity_id: 5,
    timestamp: "100",
    timestampMs: 100_000,
    storyPayload: payload,
    presentation: { title, description: title },
  }) as unknown as ProcessedStoryEvent;
/** An opened crate of this pack, by army 9 on the hex (3, 4). */
const crateOf = (pack: "War" | "Produce" | "Fortress", title: string) =>
  story(
    `crate-${pack}`,
    "RelicChestOpened",
    PLAYER,
    { explorer_id: 9, coord: { x: 3, y: 4 }, relics: relicChestRelics({ pack, lucky: false }) },
    title,
  );
const crate = crateOf("War", "Crate opened: 3 relics to the army Stolsli T1");

let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  game.armies = new Set([9]);
  game.mapView = true;
  game.navigate.mockClear();
  game.selectArmy.mockClear();
  game.goToStructure.mockClear();
});
afterEach(() => host.remove());

/** The Events stories among these, as the card selects them under Important, its first lens. */
const eventsRows = (stories: ProcessedStoryEvent[]) => selectEventStories(stories, "important", PLAYER, () => false);

const clickRow = async (event: ProcessedStoryEvent) => {
  const root = createRoot(host);
  await act(async () => root.render(<FeedRowLine event={event} />));
  await act(async () => host.querySelector("button")!.click());
  await act(async () => root.unmount());
};

describe("An opened crate in Events", () => {
  it("holds the player's opened crate, but not another player's, nor routine production", () => {
    const theirs = story("theirs", "RelicChestOpened", "0x2", { explorer_id: 7 }, "Crate opened: 3 relics to North T1");
    const production = story("made", "ProductionStory", PLAYER, {}, "Wheat produced");
    expect(eventsRows([crate, theirs, production]).map((event) => event.id)).toEqual(["crate-War"]);
  });

  it("names where the crate's relics went", () => {
    expect(renderToStaticMarkup(<FeedRowLine event={eventsRows([crate])[0]} />)).toContain(
      "Crate opened: 3 relics to the army Stolsli T1",
    );
  });

  it("selects the army holding the relics when its row is clicked, from the world map or the realm view", async () => {
    await clickRow(eventsRows([crate])[0]);
    game.mapView = false;
    await clickRow(eventsRows([crate])[0]);
    expect(game.selectArmy.mock.calls).toEqual([[9], [9]]);
    expect(game.navigate).not.toHaveBeenCalled();
  });

  it("flies to the crate's tile once the army is gone", async () => {
    game.armies = new Set();
    await clickRow(eventsRows([crate])[0]);
    expect(game.selectArmy).not.toHaveBeenCalled();
    expect(game.navigate.mock.calls[0][0].getContract()).toEqual({ x: 3, y: 4 });
    expect(game.navigate.mock.calls[0][1]).toBe("tile");
  });
});

describe("A structure pack's row", () => {
  it("selects the realm that got most of the relics, not the army that opened the crate", async () => {
    await clickRow(eventsRows([crateOf("Produce", "Crate opened: 3 relics to Stolsli")])[0]);
    expect(game.goToStructure).toHaveBeenCalledWith(5, expect.anything(), true);
    expect(game.goToStructure.mock.calls[0][1].getContract()).toEqual({ x: 70, y: 80 });
    expect(game.selectArmy).not.toHaveBeenCalled();

    game.goToStructure.mockClear();
    await clickRow(eventsRows([crateOf("Fortress", "Crate opened: 1 relic to the army Stolsli T1, 2 to Stolsli")])[0]);
    expect(game.goToStructure).toHaveBeenCalledWith(5, expect.anything(), true);
  });
});

describe("A capture in Events", () => {
  it("tells the player who lost a structure who took it from them, and what went with it, under Mine", async () => {
    const { buildStoryEventPresentation } = await import("@bibliothecadao/eternum");
    const payload = { previous_owner: PLAYER, new_owner: "0xc1", points: 0 };
    const presentation = buildStoryEventPresentation(
      {
        storyType: "StructureCapturedStory",
        storyPayload: payload,
        ownerAddress: "0xc1",
        viewerAddress: PLAYER,
      } as never,
      undefined,
      (address) => (BigInt(address) === 0xc1n ? "clientlane" : null),
    );
    const taken = {
      ...story("taken", "StructureCapturedStory", "0xc1", payload, presentation.title),
      participants: ["0xc1", PLAYER],
      presentation,
    } as ProcessedStoryEvent;
    const [event] = selectEventStories([taken], "important", PLAYER, () => false);
    expect(renderToStaticMarkup(<FeedRowLine event={event} />)).toContain(
      "clientlane took a structure from you. Its armies and deliveries went with it",
    );
  });
});

describe("A fight in Events", () => {
  /** A fight against the Vanguard, worded by the game's own story formatter, as the player's Events row. */
  const fightRow = async (attackerAfter: string, defenderAfter: string, winner: number) => {
    const { buildStoryEventPresentation } = await import("@bibliothecadao/eternum");
    const payload = {
      attacker_id: 20,
      defender_id: 21,
      attacker_owner: 10,
      defender_owner: 0,
      winner_id: winner,
      attacker: { player: PLAYER, category: "Knight", tier: "T1", before: "10", after: attackerAfter, roll: 0 },
      defender: { player: "0x0", category: "Knight", tier: "T1", before: "10", after: defenderAfter, roll: 0 },
    };
    const presentation = buildStoryEventPresentation(
      { storyType: "BattleEvent", storyPayload: payload, entityId: 20, ownerAddress: PLAYER } as never,
      undefined,
      (address) => (BigInt(address) === BigInt(PLAYER) ? "clientlane" : null),
    );
    const battle = { ...story("fight", "BattleEvent", PLAYER, payload, presentation.title), presentation };
    return renderToStaticMarkup(<FeedRowLine event={eventsRows([battle])[0]} />);
  };

  it("names a fight both sides survive a draw, which no one wins", async () => {
    const html = await fightRow("5", "4", 0);
    expect(html).toContain("clientlane vs The Vanguard · Draw");
    expect(html).not.toContain("wins");
  });

  it("names the winner of a decided fight", async () => {
    expect(await fightRow("5", "0", 10)).toContain("clientlane vs The Vanguard · clientlane wins");
  });
});

it("keeps the player's LORDS chest in Events and opens its receiving realm even after the opening army is gone", async () => {
  game.armies = new Set();
  const opened = story(
    "lords",
    "RewardChestOpened",
    PLAYER,
    { explorer_id: 9, structure_id: 5, amount: "17", coord: { x: 3, y: 4 } },
    "Chest opened: 17 LORDS to Stolsli",
  );
  expect(eventsRows([opened])).toEqual([opened]);
  await clickRow(opened);
  expect(game.goToStructure).toHaveBeenCalledWith(5, expect.anything(), true);
  expect(game.selectArmy).not.toHaveBeenCalled();
});

describe("an activated relic in Events and the Log", () => {
  it.each([
    ["important", { limit: 100, story: "RelicActivated", owner: PLAYER }, []],
    ["all", { limit: 350 }, ["another's"]],
  ] as const)(
    "reads and shows the player's activation under %s, with its recorded effect after the army is gone",
    async (filter, read, others) => {
      const { buildStoryEventPresentation } = await import("@bibliothecadao/eternum");
      const { toStreamStoryEvent } = await import("@/hooks/store/use-story-events-store");
      const activation = toStreamStoryEvent(
        {
          model: "StoryEvent",
          key: "0x1",
          value: {
            game_id: 1,
            owner: PLAYER,
            entity_id: 9,
            tx_hash: "0x123",
            timestamp: 100,
            story: {
              RelicActivated: {
                relic_id: 41,
                recipient: "Explorer",
                rate_bps: 1250,
                duration_seconds: 1800,
                radius: 0,
              },
            },
            event_position: { block_number: 10, transaction_hash: "0x123", transaction_index: 0, event_index: 2 },
          },
        },
        { chainId: "0x1", worldAddress: "0xabc", gameId: 1 },
      )!;
      const presentation = buildStoryEventPresentation(
        {
          storyType: activation.story,
          storyPayload: activation.storyPayload,
          entityId: activation.entity_id,
          ownerAddress: activation.owner,
        } as never,
        undefined,
        () => "Ada",
      );
      const event: ProcessedStoryEvent = {
        ...activation,
        id: activation.event_id,
        timestampMs: Number(BigInt(activation.timestamp)) * 1000,
        presentation,
      };
      expect(eventsReads(filter, PLAYER, [])).toContainEqual(read);
      const [row] = selectEventStories([event], filter, PLAYER, () => false);
      expect(row).toBe(event);
      // Another player's activation is world history, not the player's must-not-miss.
      const another = { ...event, id: "another's", owner: "0x2", participants: ["0x2"] };
      expect(selectEventStories([another], filter, PLAYER, () => false).map(({ id }) => id)).toEqual(others);
      game.armies = new Set();
      const root = createRoot(host);
      await act(async () =>
        root.render(
          <>
            <FeedRowLine event={row} />
            <StoryFeedRow event={row} />
          </>,
        ),
      );
      expect(host.textContent).toContain("Ada activated Damage Relic I on Army · Increases damage by 12.5% for 30m");
      expect(host.textContent!.match(/Ada activated Damage Relic I/g)).toHaveLength(2);
      await act(async () => root.unmount());
    },
  );
});

it("draws each story in Events and the Log by its act, as Frontier's Feed does, not a castle for all", () => {
  const fight = story(
    "fight",
    "BattleEvent",
    PLAYER,
    { attacker_id: 9, defender_id: 4_242 },
    "clientlane vs Emberdeep · Army lost",
  );
  const found = story("found", "ExplorationReward", PLAYER, { explorer_id: 9, coord: { x: 3, y: 4 } }, "Explored");
  const icons = (markup: string) => [...markup.matchAll(/data-icon="([^"]+)"/g)].map(([, icon]) => icon);
  for (const Row of [FeedRowLine, StoryFeedRow]) {
    expect(icons(renderToStaticMarkup(<Row event={fight} />))).toEqual(["attack"]);
    expect(icons(renderToStaticMarkup(<Row event={found} />))).toEqual(["explore"]);
    expect(icons(renderToStaticMarkup(<Row event={crate} />))).toEqual(["relics"]);
  }
});

it.each([
  [{ Shrine: 200 }, "Shrine used, +200 XP"],
  [{ ShrinePoint: 3 }, "Shrine used, +1 III skill point"],
  [{ Well: 5 }, "Well used, +5 stamina"],
])("the Log renders site use and opens its historical tile after the army is gone (%j)", async (benefit, expected) => {
  game.armies.clear();
  const event = story("site-use", "SiteUsed", PLAYER, { explorer_id: 9, coord: { x: 3, y: 4 }, benefit }, expected);
  event.presentation = buildStoryEventPresentation({
    storyType: event.story,
    storyPayload: event.storyPayload,
    entityId: 9,
    ownerAddress: PLAYER,
    viewerAddress: PLAYER,
  } as never);
  expect(eventsReads("all", PLAYER, [])).toEqual([{ limit: 350 }]);
  expect(selectEventStories([event], "all", PLAYER, () => false)).toEqual([event]);
  expect(selectEventStories([event], "important", PLAYER, () => false)).toEqual([]);
  const [row] = selectEventStories([event], "all", PLAYER, () => false);
  const root = createRoot(host);
  try {
    act(() => root.render(<StoryFeedRow event={row} />));
    expect(host.textContent).toContain(expected);
    expect(host.textContent).toContain("army");
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(game.navigate).toHaveBeenCalledOnce();
    expect(game.navigate.mock.calls[0][0].getContract()).toEqual({ x: 3, y: 4 });
  } finally {
    act(() => root.unmount());
  }
});
