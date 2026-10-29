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
// These read places, with no one to mention.
vi.mock("../hooks/use-chat-mentions", () => ({ useChatMentions: () => ({ me: null, choices: [], names: [] }) }));

const { GLOBAL_CHAT_CHANNEL_ID, StructureType } = await import("@bibliothecadao/types");
const { getBlockTimestamp, getEntityName } = await import("@bibliothecadao/eternum");
const { layOutChatLists } = await import("@/hooks/use-stick-to-latest.test-support");
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { readStructureMeaning } = await import("@/ui/design-system/domain-icon-meaning");
const { GLOBAL_ROOM } = await import("../model/chat-rooms");
const { useRealtimeChatStore } = await import("../model/store");
const { GameChatMap } = await import("./shared/chat-map");
const { RealtimeChatShell } = await import("./realtime-chat-shell");

const REALM = 7;
const GONE_ARMY = 999;
/** A camp the store holds whose tile the map does not: a place on no tile. */
const UNPLACED_CAMP = 712;
const sendWorldMessage = vi.fn(() => Promise.resolve());

/** Global with three places in it: the lab realm shared today, the same from a closed day, and an army since gone. */
const installRoom = (realmName: string, realmIcon: string, today: number) => {
  const { actions } = useRealtimeChatStore.getState();
  const place = (entityId: number, kind: string, at: number, icon: string, name: string) => ({
    place: { kind, entityId, name, icon, at },
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

let host: HTMLDivElement;
let root: Root;
let undoLayout: () => void;
let game: { realmName: string; realmIcon: string };

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  undoLayout = layOutChatLists();
  moved.openOnMap.mockClear();
  sendWorldMessage.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <LabGame
            preset={5}
            facts={(store) => {
              const realm = store.require("Structure", { game_id: 1, entity_id: REALM });
              return [
                {
                  model: "Structure",
                  key: "0x2c8",
                  value: JSON.parse(
                    JSON.stringify(
                      { ...realm, entity_id: UNPLACED_CAMP, base: { ...realm.base, category: StructureType.Camp } },
                      (_, field) => (typeof field === "bigint" ? field.toString() : field),
                    ),
                  ),
                },
              ];
            }}
          >
            {(store) => {
              moved.store = store;
              const realm = store.require("Structure", { game_id: 1, entity_id: REALM });
              game = { realmName: getEntityName(REALM, store)!, realmIcon: readStructureMeaning(store, realm) };
              return (
                <GameChatMap>
                  <RealtimeChatShell rooms={[GLOBAL_ROOM]} />
                </GameChatMap>
              );
            }}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  act(() => installRoom(game.realmName, game.realmIcon, getBlockTimestamp().currentBlockTimestamp));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  undoLayout();
  act(() => useUIStore.getState().selectOnMap(null));
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

describe("places in chat, in a game", () => {
  it("draws a place a message carries as its painting and name, after the words, and opens the map on it", () => {
    expect(chip("m1").textContent).toBe(game.realmName);
    expect(chip("m1").querySelector("img")).not.toBeNull();
    expect(host.querySelector('li[data-message-id="m1"]')!.textContent).toContain(`meet me at ${game.realmName}`);
    act(() => chip("m1").querySelector("button")!.click());
    expect(moved.openOnMap).toHaveBeenCalledWith(expect.anything(), { kind: "structure", entityId: REALM });
  });

  it("names and paints a place as the map does, whatever the message claims", () => {
    expect(chip("m5").textContent).toBe(game.realmName);
    expect(chip("m5").querySelector("img")!.getAttribute("src")).toBe(
      chip("m1").querySelector("img")!.getAttribute("src"),
    );
    expect(host.querySelector('li[data-message-id="m5"]')!.textContent).not.toContain("Isolde's Realm");
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

  it("shares the place selected on the map, as the map names and paints it, with the words sent", async () => {
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
});
