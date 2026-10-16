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
}));

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: {
        get: (model: string, key: { explorer_id?: number }) =>
          model === "ExplorerTroops" && game.armies.has(Number(key.explorer_id))
            ? { explorer_id: key.explorer_id }
            : undefined,
      },
    },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0, useNativeRow: () => undefined }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useNavigateToMapView: () => game.navigate }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: game.mapView }) }));
vi.mock("@/three/scenes/worldmap-army-select-request", () => ({ requestArmySelection: game.selectArmy }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: { getActiveGameId: () => 1 },
  entityMapPosition: () => ({ x: 50, y: 60 }),
  getEntityName: (entityId: number) => game.names.get(entityId),
  getIsBlitz: () => true,
  structureMapPosition: () => null,
}));

import { FeedRowLine } from "./feed-row-line";
import { selectImportantFeedRows, type ImportantFeedRow } from "./important-feed-rows";

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
const crate = story(
  "crate",
  "RelicChestOpened",
  PLAYER,
  { explorer_id: 9, coord: { x: 3, y: 4 } },
  "War pack: 3 relics to the army Stolsli T1",
);
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
    expect(eventsRows([crate, theirs, production]).map((row) => row.id)).toEqual(["story:crate"]);
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
