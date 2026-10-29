// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@realms-world/identity", async (original) => ({
  ...(await original<typeof import("@realms-world/identity")>()),
  fetchIdentityProfiles: async (_origin: string, accounts: string[]) =>
    Object.fromEntries(accounts.map((account) => [account, { name: null, portrait: null }])),
}));

import { GameProvider } from "@/hooks/context/game-context";
import { NativeFactStore, type GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { ROW_PX, layOutChatLists, scrollOf, scrollTo } from "@/hooks/use-stick-to-latest.test-support";
import { useRealtimeChatStore } from "../model/store";
import { GLOBAL_ROOM } from "../model/chat-rooms";
import type { DirectMessage, WorldChatMessage, WorldChatZoneState } from "../model/types";
import { RealtimeChatShell } from "./realtime-chat-shell";

const GAME = "game:0x52:7";
const THREAD = "thread-ada";

const worldMessage = (zoneId: string, index: number): WorldChatMessage =>
  ({
    id: `${zoneId}-${index}`,
    zoneId,
    sender: { playerId: `0x${(Math.abs(index) % 5) + 1}`, displayName: "Ada" },
    content: `Message ${index}`,
    createdAt: new Date(Date.UTC(2026, 9, 28, 12, 0, index)).toISOString(),
  }) as WorldChatMessage;

const directMessage = (index: number): DirectMessage => ({
  id: `dm-${index}`,
  threadId: THREAD,
  senderId: "0xada",
  recipientId: "0x7",
  content: `Whisper ${index}`,
  createdAt: new Date(Date.UTC(2026, 9, 28, 12, 0, index)).toISOString(),
});

const room = (zoneId: string, count: number): WorldChatZoneState => ({
  zoneId,
  messages: Array.from({ length: count }, (_, index) => worldMessage(zoneId, index)),
  unreadCount: 0,
  hasMoreHistory: true,
  lastFetchedCursor: "older",
  isFetchingHistory: false,
  pendingMessages: [],
});

const loadWorldHistory = vi.fn(() => Promise.resolve());

/** Signed in, Global and this game's room joined with their history read, and one DM thread: no socket, no fetch. */
const installRooms = ({ globalCount = 20 } = {}) => {
  const { actions } = useRealtimeChatStore.getState();
  useRealtimeChatStore.setState({
    connectionStatus: "connected",
    // The block list as the server answered it: nobody muted.
    blockList: { blocked: [], version: 0 },
    identity: { playerId: "0x7", displayName: "You" } as never,
    joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID, GAME],
    activeZoneId: GLOBAL_CHAT_CHANNEL_ID,
    worldZones: { [GLOBAL_CHAT_CHANNEL_ID]: room(GLOBAL_CHAT_CHANNEL_ID, globalCount), [GAME]: room(GAME, 15) },
    dmThreads: {
      [THREAD]: {
        thread: { id: THREAD, participants: ["0x7", "0xada"], createdAt: new Date(0).toISOString(), unreadCounts: {} },
        messages: Array.from({ length: 12 }, (_, index) => directMessage(index)),
        hasMoreHistory: false,
        lastFetchedCursor: undefined,
        isFetchingHistory: false,
        pendingMessages: [],
      },
    },
    onlinePlayers: { "0xada": { playerId: "0xada", displayName: "Ada", isOnline: true, isTypingInThreadIds: [] } },
    view: { kind: "room", zoneId: GLOBAL_CHAT_CHANNEL_ID },
    actions: {
      ...actions,
      initializeClient: () => undefined,
      resetClient: () => undefined,
      loadWorldHistory,
      loadDirectHistory: () => Promise.resolve(),
      markZoneAsRead: () => undefined,
      markThreadAsRead: () => undefined,
    },
  });
};

let store: NativeFactStore;
let host: HTMLDivElement;
let root: Root;
let undoLayout: () => void;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  store = new NativeFactStore();
  undoLayout = layOutChatLists();
  loadWorldHistory.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  undoLayout();
});

/** Chat opened, as the HUD opens it: Global, and the game's own room where a mode keeps one (Blitz's, when shown). */
const openChat = () =>
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x7" } as never}>
        <RealtimeChatShell rooms={[GLOBAL_ROOM, { zoneId: GAME, label: "Game" }]} />
      </GameProvider>,
    ),
  );

/** The open channel's message list: the box that scrolls its messages. */
const messageList = () => {
  const list = [...host.querySelectorAll("ul")].at(-1)?.parentElement;
  if (!list) throw new Error("no message list drawn");
  return list;
};
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
const lastMessageText = () => [...messageList().querySelectorAll("li")].at(-1)?.textContent ?? "";

const arrive = (index: number) =>
  act(() =>
    useRealtimeChatStore
      .getState()
      .actions.receiveWorldMessage(GLOBAL_CHAT_CHANNEL_ID, worldMessage(GLOBAL_CHAT_CHANNEL_ID, index)),
  );

it("opens Global on its latest message", () => {
  installRooms();
  openChat();
  const { top, latest } = scrollOf(messageList());
  expect(latest).toBeGreaterThan(0);
  expect(top).toBe(latest);
  expect(lastMessageText()).toContain("Message 19");
});

it("keeps a reader on the latest there as a message arrives", () => {
  installRooms();
  openChat();
  arrive(20);
  const { top, latest } = scrollOf(messageList());
  expect(top).toBe(latest);
  expect(lastMessageText()).toContain("Message 20");
  expect(button("New messages")).toBeUndefined();
});

it("leaves a reader scrolled up where they read, offers the jump, and the jump shows the latest", () => {
  installRooms();
  openChat();
  act(() => scrollTo(messageList(), 120));
  arrive(20);
  expect(scrollOf(messageList()).top).toBe(120);
  act(() => button("New messages")?.click());
  const { top, latest } = scrollOf(messageList());
  expect(top).toBe(latest);
  expect(button("New messages")).toBeUndefined();
});

it("takes the jump away once the reader scrolls back down to the latest", () => {
  installRooms();
  openChat();
  act(() => scrollTo(messageList(), 0));
  arrive(20);
  expect(button("New messages")).toBeDefined();
  act(() => scrollTo(messageList(), scrollOf(messageList()).latest));
  expect(button("New messages")).toBeUndefined();
});

it("follows an arrival in a room already holding its most recent 200, whose count does not change", () => {
  installRooms({ globalCount: 200 });
  openChat();
  arrive(200);
  expect(lastMessageText()).toContain("Message 200");
  const { top, latest } = scrollOf(messageList());
  expect(top).toBe(latest);
});

it("opens Game on its latest message, after Global was scrolled up", () => {
  installRooms();
  openChat();
  act(() => scrollTo(messageList(), 0));
  act(() => button("Game")?.click());
  expect(lastMessageText()).toContain("Message 14");
  const { top, latest } = scrollOf(messageList());
  expect(top).toBe(latest);
});

it("opens a DM on its latest message", () => {
  installRooms();
  openChat();
  act(() => button("Messages")?.click());
  act(() => button("Ada")?.click());
  expect(lastMessageText()).toContain("Whisper 11");
  const { top, latest } = scrollOf(messageList());
  expect(latest).toBeGreaterThan(0);
  expect(top).toBe(latest);
});

it("asks for older messages near the start, and keeps the reader's message in place when they land above", () => {
  installRooms();
  openChat();
  act(() => scrollTo(messageList(), 40));
  expect(loadWorldHistory).toHaveBeenCalledWith(expect.objectContaining({ cursor: "older" }));
  const reading = messageList().querySelectorAll("li")[2]?.textContent;
  const older = Array.from({ length: 10 }, (_, index) => worldMessage(GLOBAL_CHAT_CHANNEL_ID, -10 + index));
  act(() =>
    useRealtimeChatStore.setState((state) => {
      const zone = state.worldZones[GLOBAL_CHAT_CHANNEL_ID]!;
      return {
        worldZones: {
          ...state.worldZones,
          [GLOBAL_CHAT_CHANNEL_ID]: { ...zone, messages: [...older, ...zone.messages] },
        },
      };
    }),
  );
  const top = scrollOf(messageList()).top;
  expect(top).toBe(40 + 10 * ROW_PX);
  expect(messageList().querySelectorAll("li")[2 + 10]?.textContent).toBe(reading);
});
