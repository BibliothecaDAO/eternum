// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@realms-world/identity", async (original) => ({
  ...(await original<typeof import("@realms-world/identity")>()),
  fetchIdentityProfiles: async (_origin: string, accounts: string[]) =>
    Object.fromEntries(accounts.map((account) => [account, { name: null, portrait: null }])),
}));

// The game's players to mention need a game; these tests read the chat's frame and lists, with no one to mention.
vi.mock("../hooks/use-chat-mentions", () => ({ useChatMentions: () => ({ me: null, choices: [], names: [] }) }));

import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { layOutChatLists } from "@/hooks/use-stick-to-latest.test-support";
import { GLOBAL_ROOM } from "../model/chat-rooms";
import { useRealtimeChatStore } from "../model/store";
import type { DirectMessage, DirectMessageThreadState, WorldChatMessage } from "../model/types";
import { RealtimeChatShell } from "./realtime-chat-shell";

const SELF = "0x7";
const ALDRIC = "0xa1d";
const ISOLDE = "0x150";

const said = (zoneId: string, index: number, playerId: string, displayName: string): WorldChatMessage =>
  ({
    id: `${zoneId}-${index}`,
    zoneId,
    sender: { playerId, displayName },
    content: `Room line ${index}`,
    createdAt: new Date(Date.UTC(2026, 9, 28, 12, index)).toISOString(),
  }) as WorldChatMessage;

const thread = (other: string, lines: [string, string][], minute: number, unread: number) => {
  const id = `${SELF}|${other}`;
  return {
    thread: { id, participants: [SELF, other], createdAt: new Date(0).toISOString(), unreadCounts: { [SELF]: unread } },
    messages: lines.map(
      ([sender, content], index): DirectMessage => ({
        id: `${id}-${index}`,
        threadId: id,
        senderId: sender,
        recipientId: sender === SELF ? other : SELF,
        content,
        createdAt: new Date(Date.UTC(2026, 9, 28, 12, minute + index)).toISOString(),
      }),
    ),
    hasMoreHistory: false,
    lastFetchedCursor: undefined,
    isFetchingHistory: false,
    pendingMessages: [],
  } satisfies DirectMessageThreadState;
};

/**
 * Signed in, Global read with Aldric in it, and two conversations: Aldric's, newer and unread, and Isolde's, who is
 * offline. No socket, no fetch.
 */
const install = () => {
  const { actions } = useRealtimeChatStore.getState();
  const aldric = thread(ALDRIC, [[ALDRIC, "merge armies tomorrow?"]], 30, 1);
  const isolde = thread(
    ISOLDE,
    [
      [ISOLDE, "deal, I take the camp"],
      [SELF, "and I clear the ruin"],
    ],
    10,
    0,
  );
  useRealtimeChatStore.setState({
    connectionStatus: "connected",
    // The block list as the server answered it: nobody muted.
    blockList: { blocked: [], version: 0 },
    identity: { playerId: SELF, displayName: "You" },
    joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID],
    activeZoneId: GLOBAL_CHAT_CHANNEL_ID,
    activeThreadId: undefined,
    worldZones: {
      [GLOBAL_CHAT_CHANNEL_ID]: {
        zoneId: GLOBAL_CHAT_CHANNEL_ID,
        messages: [said(GLOBAL_CHAT_CHANNEL_ID, 0, ALDRIC, "Aldric")],
        unreadCount: 0,
        hasMoreHistory: false,
        lastFetchedCursor: null,
        isFetchingHistory: false,
        pendingMessages: [],
      },
    },
    dmThreads: { [aldric.thread.id]: aldric, [isolde.thread.id]: isolde },
    unreadWorldTotal: 0,
    onlinePlayers: { [ALDRIC]: { playerId: ALDRIC, displayName: "Aldric", isOnline: true, isTypingInThreadIds: [] } },
    view: { kind: "room", zoneId: GLOBAL_CHAT_CHANNEL_ID },
    // Shown, as the HUD's chat window says when it is open.
    isShellOpen: true,
    actions: {
      ...actions,
      initializeClient: () => undefined,
      resetClient: () => undefined,
      loadWorldHistory: () => Promise.resolve(),
      loadDirectHistory: () => Promise.resolve(),
    },
  });
};

let host: HTMLDivElement;
let root: Root;
let undoLayout: () => void;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  undoLayout = layOutChatLists();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  install();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  undoLayout();
});

const open = (rooms = [GLOBAL_ROOM]) => act(() => root.render(<RealtimeChatShell rooms={rooms} />));
const tabs = () => [...host.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
const chosenTab = () => host.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
const press = (text: string) =>
  act(() => {
    const target = [...host.querySelectorAll("button")].find((button) => button.textContent?.trim().startsWith(text));
    if (!target) throw new Error(`no button "${text}"`);
    target.click();
  });
const field = () => host.querySelector<HTMLInputElement>('input[aria-label="Message"]');

describe("the chat: rooms, then Messages", () => {
  it("shows Global and Messages, Messages counting what is unread, and nothing else in its bar", () => {
    open();
    expect(tabs()).toEqual(["Global", "Messages1"]);
    expect(chosenTab()).toBe("Global");
    expect(field()?.placeholder).toBe("Message Global");
    for (const gone of ["+ DM", "💾", "😀"]) expect(host.textContent).not.toContain(gone);
  });

  it("puts a game's own room between Global and Messages where its mode keeps one", () => {
    open([GLOBAL_ROOM, { zoneId: "game:0x52:7", label: "Game" }]);
    expect(tabs()).toEqual(["Global", "Game", "Messages1"]);
  });

  it("lists each conversation by the other player's name, the latest first, with its last line and its unread", () => {
    open();
    press("Messages");
    const rows = [...host.querySelectorAll(".ui-row")].map((row) => row.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Aldric");
    expect(rows[0]).toContain("merge armies tomorrow?");
    expect(rows[0]).toContain("1");
    expect(rows[1]).toContain("and I clear the ruin");
    // Private lines are never written in the room.
    expect(useRealtimeChatStore.getState().worldZones[GLOBAL_CHAT_CHANNEL_ID]!.messages).toHaveLength(1);
  });

  it("opens a conversation from Messages, by name, read, and goes back to the list", () => {
    open();
    press("Messages");
    press("Aldric");
    expect(chosenTab()).toBe("Messages");
    expect(host.querySelector("header")?.textContent).toContain("Aldric");
    expect(host.textContent).toContain("merge armies tomorrow?");
    expect(tabs()).toEqual(["Global", "Messages"]);
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Back"]')?.click());
    expect(host.querySelectorAll(".ui-row")).toHaveLength(2);
  });

  it("writes to a player who is offline: the field stands, with no notice in its place", () => {
    open();
    press("Messages");
    act(() => [...host.querySelectorAll<HTMLButtonElement>(".ui-row button")].at(-1)?.click());
    expect(host.textContent).toContain("deal, I take the camp");
    expect(field()?.disabled).toBe(false);
    expect(host.textContent).not.toContain("offline");
  });

  it("opens the conversation with a player from their name in the room, through their card's Message", () => {
    open();
    act(() =>
      [...host.querySelectorAll<HTMLButtonElement>("li[data-message-id] p button")]
        .find((name) => name.textContent === "Aldric")
        ?.click(),
    );
    const card = host.querySelector('[data-player-card="' + ALDRIC + '"]')!;
    expect(card.textContent).toContain("Aldric");
    act(() => [...card.querySelectorAll("button")].find((button) => button.textContent === "Message")!.click());
    expect(chosenTab()).toBe("Messages");
    expect(host.querySelector("header")?.textContent).toContain("Aldric");
  });
});
