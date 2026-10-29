// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real chat over the lab's game, its map the real one the HUD reads: only the map's movement stands in, as the
// test page has no game route to move on.
const moved = vi.hoisted(() => ({ openOnMap: vi.fn(), selectArmy: vi.fn(), store: null as unknown }));
// The game the client plays is the lab's: the day a place was shared is read on its rules.
vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  getActiveGameStore: () => moved.store,
}));
vi.mock("@/play/navigation/open-place", async (original) => ({
  ...(await original<typeof import("@/play/navigation/open-place")>()),
  openOnMap: moved.openOnMap,
}));
vi.mock("@/hooks/helpers/use-navigate", async (original) => ({
  ...(await original<typeof import("@/hooks/helpers/use-navigate")>()),
  useSelectArmyOnMap: () => moved.selectArmy,
}));
// Signed in, as the strip reads it.
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-in", session: { user: { id: "u1", realmsId: "0x7", name: "You" } } }),
}));
// The room is the test's: no connection opens one (the strip's own hook, useGameChat, stays the real one).
vi.mock("@/ui/features/world/containers/hud-chat-window", async (original) => ({
  ...(await original<typeof import("@/ui/features/world/containers/hud-chat-window")>()),
  GameChatConnection: () => null,
}));
// These read places, with no one to mention.
vi.mock("../hooks/use-chat-mentions", () => ({ useChatMentions: () => ({ me: null, choices: [], names: [] }) }));

const { GLOBAL_CHAT_CHANNEL_ID, StructureType, TileOccupier } = await import("@bibliothecadao/types");
const { getBlockTimestamp, getEntityName } = await import("@bibliothecadao/eternum");
const { layOutChatLists } = await import("@/hooks/use-stick-to-latest.test-support");
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { readStructureMeaning } = await import("@/ui/design-system/domain-icon-meaning");
const { MAP_SITES } = await import("@/config/map-sites");
const { mapSite } = await import("@/ui/features/frontier/sites/map-site-plan");
const { useGameChat } = await import("@/ui/features/world/containers/hud-chat-window");
const { GLOBAL_ROOM } = await import("../model/chat-rooms");
const { useRealtimeChatStore } = await import("../model/store");
const { GameChatMap } = await import("./shared/chat-map");
const { RealtimeChatShell } = await import("./realtime-chat-shell");

type Store = import("@bibliothecadao/eternum/game-client").NativeFactStore;

const REALM = 7;
const GONE_ARMY = 999;
/** A camp the store holds whose tile the map does not: a place on no tile. */
const UNPLACED_CAMP = 712;
/** The lab game, as the page plays it (LabGame's setActiveGame). */
const LAB = { chainId: "0x1ab", gameId: 1, name: "Lab" };
/** The tile each of the map's sites stands on in these tests, in MAP_SITES' order. */
const siteTile = (index: number) => ({ col: 30 + index, row: 30, alt: false });
const sendWorldMessage = vi.fn(() => Promise.resolve());

/**
 * Global with its places: the lab realm shared today, the same from a closed day, an army since gone, a camp on no
 * tile, the realm as a forged message names it, and the realm's number in another game on this chain and on another.
 */
const installRoom = (realmName: string, realmIcon: string, today: number) => {
  const { actions } = useRealtimeChatStore.getState();
  const place = (entityId: number, kind: string, at: number, icon: string, name: string, game: object = LAB) => ({
    place: { kind, entityId, game, name, icon, at },
  });
  const said = (id: string, content: string, metadata: object) => ({
    id,
    zoneId: GLOBAL_CHAT_CHANNEL_ID,
    sender: { playerId: "0xa1d", displayName: "Aldric" },
    content,
    createdAt: new Date(Date.UTC(2026, 9, 28, 12, Number(id.slice(1)))).toISOString(),
    metadata,
  });
  useRealtimeChatStore.setState({
    connectionStatus: "connected",
    // The block list as the server answered it: nobody muted.
    blockedPlayers: [],
    identity: { playerId: "0x7", displayName: "You" },
    joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID],
    activeZoneId: GLOBAL_CHAT_CHANNEL_ID,
    worldZones: {
      [GLOBAL_CHAT_CHANNEL_ID]: {
        zoneId: GLOBAL_CHAT_CHANNEL_ID,
        messages: [
          said("m1", "meet me at", place(REALM, "structure", today, realmIcon, realmName)),
          said("m2", realmName, place(REALM, "structure", today - 3 * 86_400, realmIcon, realmName)),
          said("m3", "my army", place(GONE_ARMY, "army", today, "knight-t1", "Iron Wardens")),
          said("m4", "the camp", place(UNPLACED_CAMP, "structure", today, "camp", "Gloomsgrasp")),
          // Sent by a client that names and paints the lab realm as another player's camp.
          said("m5", "come home", place(REALM, "structure", today, "camp", "Isolde's Realm")),
          // The realm's number in another game: on this chain, and on another chain.
          said(
            "m6",
            "here",
            place(REALM, "structure", today, "camp", "Moondeep", { ...LAB, gameId: 4, name: "Lab 4" }),
          ),
          said("m7", "there", place(REALM, "structure", today, "camp", "Ashfall", { ...LAB, chainId: "0x2b" })),
        ] as never,
        unreadCount: 0,
        hasMoreHistory: false,
        lastFetchedCursor: null,
        isFetchingHistory: false,
        pendingMessages: [],
      },
    },
    dmThreads: {},
    view: { kind: "room", zoneId: GLOBAL_CHAT_CHANNEL_ID },
    actions: {
      ...actions,
      initializeClient: () => undefined,
      resetClient: () => undefined,
      loadWorldHistory: () => Promise.resolve(),
      sendWorldMessage,
    },
  });
};

/** The chat strip's line, as the game's chat hook makes it. */
const Strip = () => <p data-strip>{useGameChat(false).stripLine}</p>;

let host: HTMLDivElement;
let root: Root;
let undoLayout: () => void;
let game: { realmName: string; realmIcon: string; store: Store };

/**
 * The lab game, mounted as the game mounts it: Frontier (preset 5, its map built again each day), or a game with one map
 * all game (Blitz, preset 2: no day, the realm on its own tile). Each map site stands on its tile.
 */
const mount = async (mode: "frontier" | "blitz") => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <LabGame
            preset={mode === "frontier" ? 5 : 2}
            facts={(store) => {
              const realm = store.require("Structure", { game_id: 1, entity_id: REALM });
              const rules = store.require("SliceRules", { game_id: 1 });
              const json = (value: object) =>
                JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
              return [
                {
                  model: "Structure",
                  key: "0x2c8",
                  value: json({
                    ...realm,
                    entity_id: UNPLACED_CAMP,
                    base: { ...realm.base, category: StructureType.Camp },
                  }),
                },
                ...MAP_SITES.map((site, index) => ({
                  model: "TileOccupancy",
                  key: `0x5170${index}`,
                  value: {
                    game_id: 1,
                    ...siteTile(index),
                    entity_id: 900 + index,
                    category: site.occupier,
                    is_structure: false,
                  },
                })),
                ...(mode === "blitz"
                  ? [
                      { model: "SliceRules", key: "0x100", value: json({ ...rules, day_unit_seconds: 0 }) },
                      {
                        model: "TileOccupancy",
                        key: "0x5171",
                        value: {
                          game_id: 1,
                          col: 20,
                          row: 20,
                          alt: false,
                          entity_id: REALM,
                          category: TileOccupier.RealmRegularLevel1,
                          is_structure: true,
                        },
                      },
                    ]
                  : []),
              ];
            }}
          >
            {(store) => {
              moved.store = store;
              const realm = store.require("Structure", { game_id: 1, entity_id: REALM });
              game = {
                realmName: getEntityName(REALM, store)!,
                realmIcon: readStructureMeaning(store, realm),
                store,
              };
              return (
                <GameChatMap>
                  <RealtimeChatShell rooms={[GLOBAL_ROOM]} />
                  <Strip />
                </GameChatMap>
              );
            }}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  act(() => installRoom(game.realmName, game.realmIcon, getBlockTimestamp().currentBlockTimestamp));
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  undoLayout = layOutChatLists();
  moved.openOnMap.mockClear();
  moved.selectArmy.mockClear();
  sendWorldMessage.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  undoLayout();
  act(() => useUIStore.getState().selectOnMap(null));
  act(() => useUIStore.getState().setMapLayer(false));
});

const chip = (id: string) => host.querySelector<HTMLElement>(`li[data-message-id="${id}"] [data-place]`)!;
const placeButton = () => host.querySelector<HTMLButtonElement>('button[aria-label="Share the selected place"]')!;
const type = (text: string) =>
  act(() => {
    const field = host.querySelector<HTMLInputElement>('input[aria-label="Message"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
const send = () => act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
const sentPlace = () =>
  (sendWorldMessage.mock.calls.at(-1) as unknown as [string, { metadata?: { place?: unknown } }])[1];
/** A message from Aldric, added last to the room. */
const arrives = (id: string, content: string, metadata: object) =>
  act(() =>
    useRealtimeChatStore.setState((state) => {
      const room = state.worldZones[GLOBAL_CHAT_CHANNEL_ID]!;
      const message = {
        id,
        zoneId: GLOBAL_CHAT_CHANNEL_ID,
        sender: { playerId: "0xa1d", displayName: "Aldric" },
        content,
        createdAt: new Date(Date.UTC(2026, 9, 28, 13, Number(id.slice(1)))).toISOString(),
        metadata,
      };
      return { worldZones: { [GLOBAL_CHAT_CHANNEL_ID]: { ...room, messages: [...room.messages, message] as never } } };
    }),
  );

describe("places in chat, in a Frontier game", () => {
  beforeEach(() => mount("frontier"));

  it("draws a place a message carries as its painting and name, after the words, and opens the map on it", () => {
    expect(chip("m1").textContent).toBe(game.realmName);
    expect(chip("m1").getAttribute("data-place-key")).toBe(`0x1ab:1/structure:${REALM}`);
    expect(chip("m1").querySelector("img")).not.toBeNull();
    expect(host.querySelector('li[data-message-id="m1"]')!.textContent).toContain(`meet me at ${game.realmName}`);
    act(() => chip("m1").querySelector("button")!.click());
    expect(moved.openOnMap).toHaveBeenCalledWith(expect.anything(), { kind: "structure", entityId: REALM });
  });

  it("names and paints a place as the map does, whatever the message claims, in the room and on the strip", () => {
    expect(chip("m5").textContent).toBe(game.realmName);
    expect(chip("m5").querySelector("img")!.getAttribute("src")).toBe(
      chip("m1").querySelector("img")!.getAttribute("src"),
    );
    expect(host.querySelector('li[data-message-id="m5"]')!.textContent).not.toContain("Isolde's Realm");
    // The strip reads the room's last message, here a forged one: the chip's name, not the message's.
    arrives("m10", "come home", {
      place: {
        kind: "structure",
        entityId: REALM,
        game: LAB,
        name: "Isolde's Realm",
        icon: "camp",
        at: getBlockTimestamp().currentBlockTimestamp,
      },
    });
    expect(host.querySelector("[data-strip]")!.textContent).toBe(`Aldric: come home ${game.realmName}`);
    expect(chip("m10").textContent).toBe(game.realmName);
  });

  it("strikes through a place from a closed Frontier day, one gone, and one on no tile: none opens", () => {
    for (const id of ["m2", "m3", "m4"]) {
      expect(chip(id).className).toContain("line-through");
      expect(chip(id).querySelector("button")?.disabled ?? true).toBe(true);
    }
    // A place sent with no words reads as its name once.
    expect(host.querySelector('li[data-message-id="m2"]')!.textContent).not.toContain(
      `${game.realmName}${game.realmName}`,
    );
  });

  it("reads a place in another game as the message has it, names that game, and opens nothing here", () => {
    for (const [id, name, gameName] of [
      ["m6", "Moondeep", "Lab 4"],
      ["m7", "Ashfall", "Lab"],
    ] as const) {
      // Never the lab realm that has the same number here.
      expect(chip(id).querySelector("button, [role]")?.textContent ?? chip(id).textContent).toContain(name);
      expect(chip(id).textContent).not.toContain(game.realmName);
      expect(chip(id).textContent).toContain(`in ${gameName}`);
      expect(chip(id).hasAttribute("data-elsewhere")).toBe(true);
      expect(chip(id).getAttribute("data-place-key")).not.toBe(`0x1ab:1/structure:${REALM}`);
      expect(chip(id).className).not.toContain("line-through");
      chip(id).querySelector("button")?.click();
    }
    expect(moved.openOnMap).not.toHaveBeenCalled();
  });

  it("shares the place selected on the map, as the map names and paints it, with its game and the words sent", async () => {
    expect(placeButton().disabled).toBe(true);
    act(() => useUIStore.getState().selectOnMap({ kind: "structure", entityId: REALM }));
    expect(placeButton().disabled).toBe(false);
    act(() => placeButton().click());
    expect(host.querySelector("form [data-place]")!.textContent).toBe(game.realmName);
    type("hold here");
    await send();
    expect(sendWorldMessage).toHaveBeenCalledWith(GLOBAL_CHAT_CHANNEL_ID, {
      content: "hold here",
      zoneId: GLOBAL_CHAT_CHANNEL_ID,
      metadata: {
        place: {
          kind: "structure",
          entityId: REALM,
          game: LAB,
          name: game.realmName,
          icon: game.realmIcon,
          at: expect.any(Number),
        },
      },
    });
    expect(host.querySelector("form [data-place]")).toBeNull();
  });

  it("sends a place alone, with no words, as its name", async () => {
    act(() => useUIStore.getState().selectOnMap({ kind: "structure", entityId: REALM }));
    act(() => placeButton().click());
    await send();
    expect(sendWorldMessage).toHaveBeenCalledWith(
      GLOBAL_CHAT_CHANNEL_ID,
      expect.objectContaining({ content: game.realmName }),
    );
  });

  it("takes the place off with its cross", async () => {
    act(() => useUIStore.getState().selectOnMap({ kind: "structure", entityId: REALM }));
    act(() => placeButton().click());
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Take the place off"]')!.click());
    type("no place");
    await send();
    expect(sendWorldMessage).toHaveBeenCalledWith(GLOBAL_CHAT_CHANNEL_ID, {
      content: "no place",
      zoneId: GLOBAL_CHAT_CHANNEL_ID,
    });
  });

  it("offers no place for a bare tile", () => {
    act(() => useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 1, row: 1 } }));
    expect(placeButton().disabled).toBe(true);
  });

  // Every site of the map's own catalog (MAP_SITES, which the renderer draws from): one it adds is covered here.
  it.each(MAP_SITES.map((entry, index) => [entry.kind, { ...entry, ...mapSite(entry.kind) }, index] as const))(
    "shares a %s selected on its tile, opens its tile, and strikes it through once spent",
    async (_, site, index) => {
      const tile = siteTile(index);
      act(() => useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: tile.col, row: tile.row } }));
      expect(placeButton().disabled).toBe(false);
      act(() => placeButton().click());
      const picked = host.querySelector<HTMLElement>("form [data-place]")!;
      expect(picked.textContent).toBe(site.name);
      await send();
      const place = {
        kind: "site",
        site: site.kind,
        tile,
        game: LAB,
        name: site.name,
        icon: site.icon,
        at: expect.any(Number),
      };
      expect(sentPlace()).toEqual({ content: site.name, zoneId: GLOBAL_CHAT_CHANNEL_ID, metadata: { place } });

      arrives("m11", site.name, sentPlace().metadata!);
      expect(chip("m11").textContent).toBe(site.name);
      expect(chip("m11").getAttribute("data-place-key")).toBe(
        `0x1ab:1/site:${site.kind}@${tile.col},${tile.row},surface`,
      );
      act(() => chip("m11").querySelector("button")!.click());
      const [position, select] = moved.openOnMap.mock.calls.at(-1)!;
      expect(position.getContract()).toEqual({ x: tile.col, y: tile.row });
      expect(select).toBe("tile");

      // Used: its tile empties, and the place it was opens nothing.
      act(() => game.store.applyFacts([{ model: "TileOccupancy", key: `0x5170${index}`, value: null }] as never));
      expect(chip("m11").className).toContain("line-through");
      expect(chip("m11").querySelector("button")?.disabled ?? true).toBe(true);
    },
  );
});

describe("places in chat, in a game with one map all game (Blitz)", () => {
  beforeEach(() => mount("blitz"));

  it("opens a place shared days ago: the map is the same", () => {
    expect(chip("m2").className).not.toContain("line-through");
    act(() => chip("m2").querySelector("button")!.click());
    expect(moved.openOnMap).toHaveBeenCalledWith(expect.anything(), { kind: "structure", entityId: REALM });
  });

  it("still opens nothing for the same number in another game", () => {
    chip("m6").querySelector("button")?.click();
    chip("m7").querySelector("button")?.click();
    expect(moved.openOnMap).not.toHaveBeenCalled();
  });
});
