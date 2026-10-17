import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { TransactionType } from "@bibliothecadao/provider";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";

/** The game as a row reads it: the armies that stand, the names of things, and the view the player is in. */
const game = vi.hoisted(() => ({
  armies: new Set<number>(),
  names: new Map<number, string>(),
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
vi.mock("@/hooks/helpers/use-navigate", () => ({
  useNavigateToMapView: () => game.navigate,
  useGoToStructure: () => game.goToStructure,
}));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: game.mapView }) }));
vi.mock("@/three/scenes/worldmap-army-select-request", () => ({ requestArmySelection: game.selectArmy }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: { getActiveGameId: () => 1 },
  entityMapPosition: () => ({ x: 50, y: 60 }),
  getEntityName: (entityId: number) => game.names.get(entityId),
  getIsBlitz: () => true,
  structureMapPosition: (_store: unknown, structure: { entity_id: bigint }) =>
    structure.entity_id === 5n ? { x: 70, y: 80 } : null,
}));

import { FeedRowLine } from "./feed-row-line";
import { selectImportantFeedRows, type ImportantFeedRow } from "./important-feed-rows";
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
const crate = crateOf("War", "War pack: 3 relics to the army Stolsli T1");
const noFeed = { inFlight: [], arrived: [], recent: [] };

let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  game.armies = new Set([9]);
  game.names = new Map();
  game.mapView = true;
  game.navigate.mockClear();
  game.selectArmy.mockClear();
  game.goToStructure.mockClear();
});
afterEach(() => host.remove());

/** The Events rows for these stories, as the card composes them. */
const eventsRows = (stories: ProcessedStoryEvent[]) => selectImportantFeedRows(stories, noFeed, "all", PLAYER);

const clickRow = async (row: ImportantFeedRow) => {
  const root = createRoot(host);
  await act(async () => root.render(<FeedRowLine row={row} />));
  await act(async () => host.querySelector("button")!.click());
  await act(async () => root.unmount());
};

describe("Transfer in the event feed", () => {
  it.each(["pending", "checking", "success", "reverted", "not_sent"] as const)(
    "keeps the donkey while %s",
    (status) => {
      const html = renderToStaticMarkup(
        <FeedRowLine
          row={{
            kind: "transaction",
            id: "transfer",
            at: 0,
            transaction: {
              hash: "0x1",
              type: TransactionType.SEND,
              status,
              submittedAt: 0,
              description: "Transfer resources",
            },
          }}
        />,
      );
      expect(html).toContain('data-icon="transfer"');
      expect(html).toContain("/icons/facets/64/donkey.webp");
      expect(html).toContain(status === "success" ? "Caravan sent" : "Transfer resources");
    },
  );
});

describe("An opened crate in Events", () => {
  it("holds the player's opened crate, but not another player's, nor routine production", () => {
    const theirs = story("theirs", "RelicChestOpened", "0x2", { explorer_id: 7 }, "War pack: 3 relics to North T1");
    const production = story("made", "ProductionStory", PLAYER, {}, "Wheat produced");
    expect(eventsRows([crate, theirs, production]).map((row) => row.id)).toEqual(["story:crate-War"]);
  });

  it("names where the crate's relics went", () => {
    expect(renderToStaticMarkup(<FeedRowLine row={eventsRows([crate])[0]} />)).toContain(
      "War pack: 3 relics to the army Stolsli T1",
    );
  });

  it("selects the army holding the relics when its row is clicked on the world map", async () => {
    await clickRow(eventsRows([crate])[0]);
    expect(game.selectArmy).toHaveBeenCalledWith(9);
    expect(game.navigate).not.toHaveBeenCalled();
  });

  it("flies to the army from the realm view, and to the crate's tile once the army is gone", async () => {
    game.mapView = false;
    await clickRow(eventsRows([crate])[0]);
    expect(game.navigate.mock.calls[0][0].getContract()).toEqual({ x: 50, y: 60 });

    game.armies = new Set();
    game.mapView = true;
    await clickRow(eventsRows([crate])[0]);
    expect(game.selectArmy).not.toHaveBeenCalled();
    expect(game.navigate.mock.calls[1][0].getContract()).toEqual({ x: 3, y: 4 });
  });
});

describe("A structure pack's row", () => {
  it("selects the realm that got most of the relics, not the army that opened the crate", async () => {
    await clickRow(eventsRows([crateOf("Produce", "Produce pack: 3 relics to Stolsli")])[0]);
    expect(game.goToStructure).toHaveBeenCalledWith(5, expect.anything(), true);
    expect(game.goToStructure.mock.calls[0][1].getContract()).toEqual({ x: 70, y: 80 });
    expect(game.selectArmy).not.toHaveBeenCalled();

    game.goToStructure.mockClear();
    await clickRow(eventsRows([crateOf("Fortress", "Fortress pack: 1 relic to the army Stolsli T1, 2 to Stolsli")])[0]);
    expect(game.goToStructure).toHaveBeenCalledWith(5, expect.anything(), true);
  });
});

describe("An arrival in Events", () => {
  it("names its recipient, never by its entity id", () => {
    const arrival = {
      kind: "arrival",
      id: "arrival",
      at: 0,
      structureEntityId: 12884901895,
      resources: [],
      arrivesAtSeconds: 0,
      remainingSeconds: 0,
    } as unknown as ImportantFeedRow;
    game.names.set(12884901895, "Egonal");
    const named = renderToStaticMarkup(<FeedRowLine row={arrival} />);
    expect(named).toContain("· Egonal");
    game.names = new Map();
    const unnamed = renderToStaticMarkup(<FeedRowLine row={arrival} />);
    expect(named + unnamed).not.toContain("12884901895");
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
    return renderToStaticMarkup(<FeedRowLine row={eventsRows([battle])[0]} />);
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
