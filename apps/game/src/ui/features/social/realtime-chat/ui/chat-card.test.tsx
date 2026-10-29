// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real chat over the lab's game, its map the real one the HUD reads: only the map's movement stands in.
const moved = vi.hoisted(() => ({ openOnMap: vi.fn(), store: null as unknown }));
vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  getActiveGameStore: () => moved.store,
}));
vi.mock("@/play/navigation/open-place", async (original) => ({
  ...(await original<typeof import("@/play/navigation/open-place")>()),
  openOnMap: moved.openOnMap,
}));
// Signed in, as the strip reads it; the room is the test's, so no connection opens one.
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-in", session: { user: { id: "u1", realmsId: "0x7", name: "You" } } }),
}));
vi.mock("@/ui/features/world/containers/hud-chat-window", async (original) => ({
  ...(await original<typeof import("@/ui/features/world/containers/hud-chat-window")>()),
  GameChatConnection: () => null,
}));
vi.mock("../hooks/use-chat-mentions", () => ({ useChatMentions: () => ({ me: null, choices: [], names: [] }) }));

const { GLOBAL_CHAT_CHANNEL_ID } = await import("@bibliothecadao/types");
const { getEntityName } = await import("@bibliothecadao/eternum");
const { realmsAccountAddress } = await import("@realms-world/identity/account");
const { layOutChatLists } = await import("@/hooks/use-stick-to-latest.test-support");
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { LAB_GUARDIAN } = await import("@/shell/lab/app-lab-fixtures");
const { GUARDIAN_QUERY } = await import("@/shell/herald");
const { useGameChat } = await import("@/ui/features/world/containers/hud-chat-window");
const { useEventFeedStore } = await import("@/ui/features/event-feed/event-feed-store");
const { GLOBAL_ROOM } = await import("../model/chat-rooms");
const { useRealtimeChatStore } = await import("../model/store");
const { GameChatMap } = await import("./shared/chat-map");
const { RealtimeChatShell } = await import("./realtime-chat-shell");
const { AudioManager } = await import("@/audio/core/AudioManager");
/** The store's own actions, before a test's room stands in for its connection. */
const STORE_ACTIONS = useRealtimeChatStore.getState().actions;

const SELF = "0x7";
const ALDRIC = "0xa1d";
const CORWIN = "0xc0e";
/** A player the lab's player only writes to privately: never in a room. */
const DAGNA = "0xd46";
/** Aldric's realm in the lab game: owned by the account his Realms id makes under the shard's guardian. */
const ALDRIC_REALM = 77;
const BASE = "https://chat.test";

const said = (id: string, playerId: string, displayName: string, content: string, minute: number) => ({
  id,
  zoneId: GLOBAL_CHAT_CHANNEL_ID,
  sender: { playerId, displayName },
  content,
  createdAt: new Date(Date.UTC(2026, 9, 29, 12, minute)).toISOString(),
});

/** Global: Aldric's run of two, Corwin, then the player; three players online. */
const installRoom = () => {
  const { actions } = useRealtimeChatStore.getState();
  useRealtimeChatStore.setState({
    connectionStatus: "connected",
    baseUrl: BASE,
    identity: { playerId: SELF, displayName: "You" },
    joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID],
    activeZoneId: GLOBAL_CHAT_CHANNEL_ID,
    worldZones: {
      [GLOBAL_CHAT_CHANNEL_ID]: {
        zoneId: GLOBAL_CHAT_CHANNEL_ID,
        messages: [
          said("m1", ALDRIC, "Aldric", "gg on the spire", 1),
          said("m2", ALDRIC, "Aldric", "merge armies tomorrow?", 2),
          said("m3", CORWIN, "Corwin", "the camps are where the labor is", 3),
          said("m4", SELF, "You", "on my way", 4),
        ] as never,
        unreadCount: 0,
        hasMoreHistory: false,
        lastFetchedCursor: null,
        isFetchingHistory: false,
        pendingMessages: [],
      },
    },
    onlinePlayers: Object.fromEntries(
      [SELF, ALDRIC, CORWIN].map((playerId) => [
        playerId,
        { playerId, displayName: null, isOnline: true, isTypingInThreadIds: [] },
      ]),
    ),
    blockedPlayers: [],
    unreadWorldTotal: 0,
    dmThreads: {},
    view: { kind: "room", zoneId: GLOBAL_CHAT_CHANNEL_ID },
    actions: { ...actions, initializeClient: () => undefined, resetClient: () => undefined },
  });
};

/** The account's block list on the server: POST adds an account, DELETE takes it off, each answering the list. */
let blocked: string[] = [];
/** While set, the block list refuses every change, as a server that is down does. */
let blockListDown = false;
/** How the server answers a read of the block list: at once, held until the test lets it go, or refused. */
let blockRead: "now" | "held" | "down" = "now";
/** Reads the server holds, oldest first: each answers the list as it stood when it was asked. */
let heldReads: (() => void)[] = [];
const answerOldestRead = () => act(async () => heldReads.shift()!());
/** The player's conversation with Dagna, as the server keeps it. */
const DAGNA_LINE = {
  id: "d1",
  threadId: `${SELF}|${DAGNA}`,
  senderId: DAGNA,
  recipientId: SELF,
  content: "see you at dawn",
  createdAt: new Date(Date.UTC(2026, 9, 29, 11, 0)).toISOString(),
};
const serve = vi.fn(async (input: string | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.pathname === "/api/chat/blocks" && (init?.method ?? "GET") === "GET") {
    if (blockRead === "down") return new Response("{}", { status: 503 });
    if (blockRead === "held") {
      const asked = [...blocked];
      await new Promise<void>((resolve) => heldReads.push(resolve));
      return new Response(JSON.stringify({ blocked: asked }), { status: 200 });
    }
  }
  if (url.pathname.startsWith("/api/chat/dm/threads/"))
    return new Response(JSON.stringify({ messages: [DAGNA_LINE], nextCursor: null }), { status: 200 });
  if (blockListDown && url.pathname.startsWith("/api/chat/blocks") && init?.method)
    return new Response("{}", { status: 503 });
  if (url.pathname === "/api/chat/blocks" && init?.method === "POST")
    blocked = [...blocked, (JSON.parse(String(init.body)) as { realmsId: string }).realmsId];
  if (url.pathname.startsWith("/api/chat/blocks/") && init?.method === "DELETE")
    blocked = blocked.filter((id) => id !== decodeURIComponent(url.pathname.split("/").at(-1)!));
  return new Response(JSON.stringify({ blocked, messages: [], nextCursor: null, profiles: {} }), { status: 200 });
});

/** The chat strip's line, as the game's chat hook makes it. */
const Strip = () => <p data-strip>{useGameChat(false).stripLine}</p>;

let host: HTMLDivElement;
let root: Root;
let undoLayout: () => void;
let aldricRealmName = "";

/** The lab game with Aldric's realm in it, the guardian answered; or, with `map: false`, chat outside a game. */
const mount = async ({ map = true } = {}) => {
  const client = new QueryClient();
  client.setQueryData(GUARDIAN_QUERY.queryKey, LAB_GUARDIAN);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <LabGame
            preset={5}
            facts={(store) => {
              const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
              const owner = realmsAccountAddress(ALDRIC, LAB_GUARDIAN.accountClassHash, LAB_GUARDIAN.publicKey);
              const value = { ...realm, entity_id: ALDRIC_REALM, owner, metadata: { ...realm.metadata, realm_id: 2 } };
              return [
                {
                  model: "Structure",
                  key: "0x2ad",
                  value: JSON.parse(JSON.stringify(value, (_, f) => (typeof f === "bigint" ? f.toString() : f))),
                },
              ];
            }}
          >
            {(store) => {
              moved.store = store;
              aldricRealmName = getEntityName(ALDRIC_REALM, store)!;
              const chat = (
                <>
                  <RealtimeChatShell rooms={[GLOBAL_ROOM]} />
                  <Strip />
                </>
              );
              return map ? <GameChatMap>{chat}</GameChatMap> : chat;
            }}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  act(() => installRoom());
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  undoLayout = layOutChatLists();
  blocked = [];
  blockListDown = false;
  blockRead = "now";
  heldReads = [];
  useEventFeedStore.getState().dismiss();
  moved.openOnMap.mockClear();
  vi.stubGlobal("fetch", serve);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  undoLayout();
  useRealtimeChatStore.getState().client?.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const nameButton = (id: string) => host.querySelector<HTMLButtonElement>(`li[data-message-id="${id}"] p button`);
const card = () => host.querySelector<HTMLElement>("[data-player-card]");
const cardButton = (words: string) =>
  [...(card()?.querySelectorAll("button") ?? [])].find((button) => button.textContent === words);
const rows = () => [...host.querySelectorAll("li[data-message-id]")].map((row) => row.getAttribute("data-message-id"));

describe("a player's card, in a game", () => {
  beforeEach(() => mount());

  it("opens under the message whose name was pressed: the player, their realm here, Message and Mute", () => {
    act(() => nameButton("m1")!.click());
    expect(card()!.getAttribute("data-player-card")).toBe(ALDRIC);
    expect(card()!.previousElementSibling!.getAttribute("data-message-id")).toBe("m1");
    expect(card()!.textContent).toContain("Aldric");
    expect(card()!.querySelector("[data-place]")!.textContent).toBe(aldricRealmName);
    expect(cardButton("Message")).toBeDefined();
    expect(cardButton("Mute")).toBeDefined();
  });

  it("opens the map on the player's realm from it", () => {
    act(() => nameButton("m1")!.click());
    act(() => card()!.querySelector<HTMLButtonElement>("[data-place] button")!.click());
    expect(moved.openOnMap).toHaveBeenCalledWith(expect.anything(), { kind: "structure", entityId: ALDRIC_REALM });
  });

  it("writes to the player privately from Message", () => {
    act(() => nameButton("m1")!.click());
    act(() => cardButton("Message")!.click());
    expect(useRealtimeChatStore.getState().view).toEqual({ kind: "conversation", threadId: `${SELF}|${ALDRIC}` });
  });

  it("is one at a time: the same name closes it, another name moves it", () => {
    act(() => nameButton("m1")!.click());
    act(() => nameButton("m3")!.click());
    expect(host.querySelectorAll("[data-player-card]")).toHaveLength(1);
    expect(card()!.getAttribute("data-player-card")).toBe(CORWIN);
    act(() => nameButton("m3")!.click());
    expect(card()).toBeNull();
  });

  it("offers no card for the player's own name", () => {
    expect(nameButton("m4")).toBeNull();
    expect(host.querySelector('li[data-message-id="m4"]')!.textContent).toContain("on my way");
  });

  it("mutes a player: their run reads as their name and muted, unheard and uncounted, off the strip; Unmute brings it back", async () => {
    act(() => nameButton("m1")!.click());
    await act(async () => cardButton("Mute")!.click());
    expect(blocked).toEqual([ALDRIC]);
    // One line for the run, its words gone, the card still open on it, now offering Unmute and no Message.
    expect(rows()).toEqual(["m1", "m3", "m4"]);
    expect(host.querySelector('li[data-message-id="m1"]')!.textContent).toContain("muted");
    expect(host.textContent).not.toContain("gg on the spire");
    expect(cardButton("Unmute")).toBeDefined();
    expect(cardButton("Message")).toBeUndefined();

    // What they write next counts nothing, and the strip keeps to the last message from a player not muted.
    act(() =>
      useRealtimeChatStore
        .getState()
        .actions.receiveWorldMessage(GLOBAL_CHAT_CHANNEL_ID, said("m5", ALDRIC, "Aldric", "hello?", 5)),
    );
    expect(useRealtimeChatStore.getState().unreadWorldTotal).toBe(0);
    expect(host.querySelector("[data-strip]")!.textContent).toBe("You: on my way");
    act(() =>
      useRealtimeChatStore
        .getState()
        .actions.receiveWorldMessage(GLOBAL_CHAT_CHANNEL_ID, said("m6", CORWIN, "Corwin", "still there", 6)),
    );
    expect(useRealtimeChatStore.getState().unreadWorldTotal).toBe(1);

    await act(async () => cardButton("Unmute")!.click());
    expect(blocked).toEqual([]);
    expect(host.textContent).toContain("gg on the spire");
    expect(host.textContent).toContain("hello?");
  });

  it("tells the player when Mute did not go through, and changes nothing", async () => {
    blockListDown = true;
    act(() => nameButton("m1")!.click());
    await act(async () => cardButton("Mute")!.click());
    expect(useEventFeedStore.getState().notices.map((notice) => notice.kind)).toEqual(["error"]);
    expect(useRealtimeChatStore.getState().blockedPlayers).toEqual([]);
    expect(host.textContent).toContain("gg on the spire");
    expect(cardButton("Mute")).toBeDefined();
  });

  it("says how many players are online beside the tabs, and nothing when none is", () => {
    expect(host.querySelector("[data-online]")!.textContent).toBe("3 online");
    act(() => useRealtimeChatStore.setState({ onlinePlayers: {} }));
    expect(host.querySelector("[data-online]")).toBeNull();
  });
});

describe("a player's card, outside a game", () => {
  beforeEach(() => mount({ map: false }));

  it("names the player with Message and Mute, and no realm: there is no map to open", () => {
    act(() => nameButton("m1")!.click());
    expect(card()!.textContent).toContain("Aldric");
    expect(card()!.querySelector("[data-place]")).toBeNull();
    expect(cardButton("Message")).toBeDefined();
    expect(cardButton("Mute")).toBeDefined();
  });
});

/** Dagna's private conversation, as it arrives, then opened. */
const openDagna = () =>
  act(() => {
    const { actions } = useRealtimeChatStore.getState();
    useRealtimeChatStore.setState({
      onlinePlayers: {
        ...useRealtimeChatStore.getState().onlinePlayers,
        [DAGNA]: { playerId: DAGNA, displayName: "Dagna", isOnline: true, isTypingInThreadIds: [] },
      },
    });
    actions.receiveDirectMessage(
      DAGNA_LINE as never,
      {
        id: DAGNA_LINE.threadId,
        participants: [SELF, DAGNA],
        createdAt: DAGNA_LINE.createdAt,
        unreadCounts: {},
      } as never,
    );
    actions.openConversation(DAGNA);
  });
const headMute = () =>
  [...host.querySelectorAll<HTMLButtonElement>("header button")].find((b) => b.textContent === "Mute")!;

const tab = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((button) => button.textContent?.startsWith(name))!;
const muted = () => host.querySelector<HTMLElement>('section[aria-label="Muted"]');

describe("a player muted who only wrote privately", () => {
  beforeEach(() => mount({ map: false }));

  it("stays in Messages, under Muted, from the server's list after a reload too; Unmute brings the conversation back", async () => {
    act(() => {
      const { actions } = useRealtimeChatStore.getState();
      useRealtimeChatStore.setState({
        onlinePlayers: {
          ...useRealtimeChatStore.getState().onlinePlayers,
          [DAGNA]: { playerId: DAGNA, displayName: "Dagna", isOnline: true, isTypingInThreadIds: [] },
        },
      });
      actions.receiveDirectMessage(
        DAGNA_LINE as never,
        {
          id: DAGNA_LINE.threadId,
          participants: [SELF, DAGNA],
          createdAt: DAGNA_LINE.createdAt,
          unreadCounts: {},
        } as never,
      );
      actions.openConversation(DAGNA);
    });
    const mute = [...host.querySelectorAll<HTMLButtonElement>("header button")].find((b) => b.textContent === "Mute")!;
    await act(async () => mute.click());

    // The server holds the mute (and drops what Dagna writes from now on); Messages lists her under Muted, not as a
    // conversation, with Unmute.
    expect(blocked).toEqual([DAGNA]);
    expect(useRealtimeChatStore.getState().view).toEqual({ kind: "messages" });
    expect(host.textContent).not.toContain("see you at dawn");
    expect(muted()!.textContent).toContain("Dagna");
    expect(muted()!.querySelector("button")!.textContent).toBe("Unmute");

    // A reload: the client starts with nothing, the server's inbox leaves her conversation out, and its block list
    // names her again.
    act(() => useRealtimeChatStore.setState({ blockedPlayers: null, dmThreads: {} }));
    expect(muted()).toBeNull();
    await act(async () => useRealtimeChatStore.getState().actions.loadBlockedPlayers());
    expect(muted()!.textContent).toContain("Dagna");

    await act(async () => muted()!.querySelector("button")!.click());
    expect(blocked).toEqual([]);
    expect(muted()).toBeNull();
    expect(host.textContent).toContain("see you at dawn");
  });
});

describe("chat starting, before it knows who is muted", () => {
  /** The chat's own start, on a connection whose sockets stay silent: the room is the test's, the block list read. */
  const start = async () => {
    vi.stubGlobal(
      "WebSocket",
      class {
        readyState = 0;
        addEventListener() {}
        send() {}
        close() {}
      },
    );
    await act(async () => STORE_ACTIONS.initializeClient({ baseUrl: BASE, rooms: [GLOBAL_CHAT_CHANNEL_ID] }));
    act(() =>
      useRealtimeChatStore.setState({
        connectionStatus: "connected",
        identity: { playerId: SELF, displayName: "You" },
        joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID],
      }),
    );
  };
  const arrive = (id: string, playerId: string, name: string, words: string, minute: number) =>
    act(() =>
      useRealtimeChatStore
        .getState()
        .actions.receiveWorldMessage(GLOBAL_CHAT_CHANNEL_ID, said(id, playerId, name, words, minute)),
    );
  const strip = () => host.querySelector("[data-strip]")!.textContent;

  beforeEach(async () => {
    // Aldric was muted in an earlier session; the server's list says so.
    blocked = [ALDRIC];
    await mount();
    act(() => tab("Messages").click());
    act(() => tab("Global").click());
  });

  it("holds the room until the list is read, then shows, counts and sounds each message as the list says", async () => {
    blockRead = "held";
    const heard = vi.spyOn(AudioManager.getInstance(), "play");
    await start();
    act(() => useRealtimeChatStore.getState().actions.setShellOpen(false));
    arrive("m5", ALDRIC, "Aldric", "muted during startup", 5);
    arrive("m6", CORWIN, "Corwin", "still there", 6);

    // Nothing of the room yet: neither Aldric's words (history or new) nor Corwin's, no count, no sound, no strip line.
    expect(host.textContent).toContain("Loading…");
    expect(rows()).toEqual([]);
    expect(host.textContent).not.toContain("gg on the spire");
    expect(tab("Global").textContent).toBe("Global");
    expect(heard).not.toHaveBeenCalled();
    expect(strip()).not.toContain("Aldric");
    expect(strip()).not.toContain("Corwin");

    await answerOldestRead();
    await act(async () => {});

    // Aldric's runs read as muted; Corwin's message stands, counted once and heard once, and is the strip's line.
    expect(host.textContent).not.toContain("muted during startup");
    expect(host.textContent).not.toContain("gg on the spire");
    expect(host.textContent).toContain("still there");
    expect(rows()).toContain("m6");
    expect(tab("Global").textContent).toBe("Global1");
    expect(heard).toHaveBeenCalledTimes(1);
    expect(strip()).toBe("Corwin: still there");
  });

  it("takes nothing from a replaced connection's late answer: the current list stands, and the room goes on", async () => {
    // The first connection's read is held with the list as it was then: nobody muted.
    blocked = [];
    blockRead = "held";
    await start();
    // A new connection reads the list as it is now: Aldric muted.
    blocked = [ALDRIC];
    blockRead = "now";
    await start();
    await act(async () => {});
    act(() => useRealtimeChatStore.getState().actions.setShellOpen(false));
    const heard = vi.spyOn(AudioManager.getInstance(), "play");
    arrive("m5", ALDRIC, "Aldric", "muted on the new connection", 5);

    await answerOldestRead();
    await act(async () => {});
    expect(useRealtimeChatStore.getState().blockedPlayers).toEqual([ALDRIC]);
    expect(host.textContent).not.toContain("muted on the new connection");
    expect(host.textContent).not.toContain("gg on the spire");
    expect(tab("Global").textContent).toBe("Global");
    expect(heard).not.toHaveBeenCalled();
    expect(strip()).not.toContain("Aldric");

    // Afterwards, the room goes on as the list says.
    arrive("m6", CORWIN, "Corwin", "still there", 6);
    expect(host.textContent).toContain("still there");
    expect(tab("Global").textContent).toBe("Global1");
    expect(heard).toHaveBeenCalledTimes(1);
    expect(strip()).toBe("Corwin: still there");
  });

  it("keeps a Mute made while an older read was out: its answer stands, and Unmute stays in reach", async () => {
    blocked = [];
    blockRead = "held";
    await start();
    openDagna();
    await act(async () => headMute().click());
    expect(blocked).toEqual([DAGNA]);
    expect(muted()!.textContent).toContain("Dagna");

    // The read asked before the Mute comes back with the list from before it: it is not taken.
    await answerOldestRead();
    await act(async () => {});
    expect(useRealtimeChatStore.getState().blockedPlayers).toEqual([DAGNA]);
    expect(muted()!.textContent).toContain("Dagna");
    expect(muted()!.querySelector("button")!.textContent).toBe("Unmute");
    expect(host.textContent).not.toContain("see you at dawn");

    // A room message from someone not muted counts and sounds; then Unmute reverses the Mute.
    const heard = vi.spyOn(AudioManager.getInstance(), "play");
    act(() => useRealtimeChatStore.getState().actions.setShellOpen(false));
    arrive("m6", CORWIN, "Corwin", "still there", 6);
    expect(tab("Global").textContent).toBe("Global1");
    expect(heard).toHaveBeenCalledTimes(1);
    await act(async () => muted()!.querySelector("button")!.click());
    expect(blocked).toEqual([]);
    expect(muted()).toBeNull();
    expect(host.textContent).toContain("see you at dawn");
  });

  it("keeps an Unmute made while an older read was out: the player stays unmuted, their words shown", async () => {
    blocked = [DAGNA];
    await start();
    await act(async () => {});
    openDagna();
    act(() => useRealtimeChatStore.getState().actions.showMessages());
    expect(muted()!.textContent).toContain("Dagna");

    // A read goes out while Dagna is muted, and is held; Unmute is pressed and answered before it.
    blockRead = "held";
    let reading!: Promise<void>;
    act(() => {
      reading = useRealtimeChatStore.getState().actions.loadBlockedPlayers();
    });
    await act(async () => muted()!.querySelector("button")!.click());
    expect(blocked).toEqual([]);
    expect(muted()).toBeNull();

    await answerOldestRead();
    await act(async () => reading);
    expect(useRealtimeChatStore.getState().blockedPlayers).toEqual([]);
    expect(muted()).toBeNull();
    expect(host.textContent).toContain("see you at dawn");

    // What she writes in a room afterwards is hers to read: shown, counted, heard.
    const heard = vi.spyOn(AudioManager.getInstance(), "play");
    act(() => useRealtimeChatStore.getState().actions.setShellOpen(false));
    arrive("m7", DAGNA, "Dagna", "back again", 7);
    expect(tab("Global").textContent).toBe("Global1");
    expect(heard).toHaveBeenCalledTimes(1);
    act(() => tab("Global").click());
    expect(host.textContent).toContain("back again");
  });

  it("says when the list could not be read, keeps the room waiting, and reads it again later", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    blockRead = "down";
    await start();
    act(() => useRealtimeChatStore.getState().actions.setShellOpen(false));
    await act(async () => {});
    arrive("m6", CORWIN, "Corwin", "still there", 6);

    expect(useEventFeedStore.getState().notices.map((notice) => notice.kind)).toEqual(["error"]);
    expect(host.textContent).toContain("Loading…");
    expect(useRealtimeChatStore.getState().blockedPlayers).toBeNull();
    expect(tab("Global").textContent).toBe("Global");

    // The server comes back: the next read, two seconds on, takes the room as it would have been.
    blockRead = "now";
    await act(async () => vi.advanceTimersByTime(2_000));
    await act(async () => {});
    expect(useRealtimeChatStore.getState().blockedPlayers).toEqual([ALDRIC]);
    expect(host.textContent).toContain("still there");
    expect(host.textContent).not.toContain("gg on the spire");
    expect(tab("Global").textContent).toBe("Global1");
    // Told once, not at each try.
    expect(useEventFeedStore.getState().notices).toHaveLength(1);
  });
});
