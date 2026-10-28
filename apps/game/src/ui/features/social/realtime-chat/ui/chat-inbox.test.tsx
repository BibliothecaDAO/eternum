// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@realms-world/identity", async (original) => ({
  ...(await original<typeof import("@realms-world/identity")>()),
  fetchIdentityProfiles: async (_origin: string, accounts: string[]) =>
    Object.fromEntries(accounts.map((account) => [account, { name: null, portrait: null }])),
}));
// These read conversations and rooms, with no one to mention.
vi.mock("../hooks/use-chat-mentions", () => ({ useChatMentions: () => ({ me: null, choices: [], names: [] }) }));

import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { layOutChatLists } from "@/hooks/use-stick-to-latest.test-support";
import { GLOBAL_ROOM } from "../model/chat-rooms";
import { useRealtimeChatStore } from "../model/store";
import { RealtimeChatShell } from "./realtime-chat-shell";

const SELF = "0x7";
const ALDRIC = "0xa1d";
const THREAD = `${SELF}|${ALDRIC}`;
const BASE = "https://chat.test";

/** A socket the test drives, as a browser's: it opens, receives, and keeps what the client sent. */
class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static made: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  readonly sent: Record<string, unknown>[] = [];
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();
  constructor(readonly url: string) {
    FakeSocket.made.push(this);
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = FakeSocket.CLOSED;
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.#listeners.get("open")?.forEach((listener) => listener({}));
  }
  receive(message: unknown) {
    this.#listeners.get("message")?.forEach((listener) => listener({ data: JSON.stringify(message) }));
  }
}

const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 12, minute)).toISOString();
const message = (id: string, senderId: string, content: string, minute: number) => ({
  id,
  threadId: THREAD,
  senderId,
  recipientId: senderId === SELF ? ALDRIC : SELF,
  content,
  createdAt: at(minute),
});
const HISTORY = [message("d1", SELF, "how goes the ruin?", 1), message("d2", ALDRIC, "are you there", 30)];

/** Aldric's conversation as the player's inbox sends it: the thread, with the unread it counts, and its last line. */
const threadOf = (unread: number, last: ReturnType<typeof message> = HISTORY[1]!) => ({
  id: THREAD,
  participants: [SELF, ALDRIC],
  createdAt: at(1),
  updatedAt: last.createdAt,
  lastMessageId: last.id,
  unreadCounts: { [SELF]: unread },
  typing: [],
});
const listing = (unread: number, last: ReturnType<typeof message> = HISTORY[1]!) => [
  { thread: threadOf(unread, last), lastMessage: last },
];
/** The inbox's handshake: Global and a game room the player is not shown, and the player's conversations. */
const handshake = (threads: ReturnType<typeof listing>) => ({
  type: "connected",
  playerId: SELF,
  displayName: "You",
  channels: [GLOBAL_CHAT_CHANNEL_ID, "game:7"],
  threads,
});

/** The server's routes: a conversation's history (one page), the block list and the room's history. */
const serve = (
  page: { messages: unknown[]; nextCursor: string | null } = { messages: [...HISTORY].reverse(), nextCursor: null },
) =>
  vi.fn(async (input: string | URL) => {
    const { pathname } = new URL(String(input));
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (pathname === `/api/chat/dm/threads/${THREAD}/messages`) return json(page);
    if (pathname === "/api/chat/blocks") return json({ blocked: [] });
    if (pathname === "/api/chat/world") return json({ messages: [], nextCursor: null });
    return new Response("{}", { status: 404 });
  });

let host: HTMLDivElement;
let root: Root;
let undoLayout: () => void;

/** A client starting empty, as a reload or a new device starts it: chat opened, the inbox's handshake received. */
const startEmpty = async (unread: number, page?: Parameters<typeof serve>[0]) => {
  vi.stubGlobal("fetch", serve(page));
  useRealtimeChatStore.getState().actions.resetClient();
  await act(async () =>
    useRealtimeChatStore.getState().actions.initializeClient({ baseUrl: BASE, rooms: [GLOBAL_ROOM.zoneId] }),
  );
  // Shown, as the HUD's chat window says when it is open.
  useRealtimeChatStore.getState().actions.setShellOpen(true);
  await act(async () => root.render(<RealtimeChatShell rooms={[GLOBAL_ROOM]} />));
  const inbox = FakeSocket.made.at(-1)!;
  await act(async () => {
    inbox.open();
    inbox.receive(handshake(listing(unread)));
  });
  return inbox;
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  undoLayout = layOutChatLists();
  FakeSocket.made = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  useRealtimeChatStore.getState().actions.resetClient();
  host.remove();
  undoLayout();
  vi.unstubAllGlobals();
});

const press = (text: string) =>
  act(async () => {
    const target = [...host.querySelectorAll("button")].find((button) => button.textContent?.trim().startsWith(text));
    if (!target) throw new Error(`no button "${text}"`);
    target.click();
  });
const tabs = () => [...host.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
const rows = () => [...host.querySelectorAll(".ui-row")];
const roomPaths = () =>
  FakeSocket.made.map((socket) => new URL(socket.url).pathname).filter((path) => path.includes("rooms"));

const receipts = (inbox: FakeSocket) =>
  inbox.sent
    .filter((frame) => frame.type === "direct:read")
    .map((frame) => (frame.payload as { messageId: string }).messageId);
/** A line from Aldric over the socket, with the thread as the inbox counts it then. */
const arrives = (inbox: FakeSocket, line: ReturnType<typeof message>, unread: number) =>
  act(async () => inbox.receive({ type: "direct:message", message: line, thread: threadOf(unread, line) }));
/** The inbox's recount after a read on one of the player's devices. */
const recounted = (inbox: FakeSocket, unread: number, last?: ReturnType<typeof message>) =>
  act(async () => inbox.receive({ type: "direct:thread", thread: threadOf(unread, last) }));
const openConversation = async () => {
  await press("Messages");
  await act(async () => rows()[0]!.querySelector("button")!.click());
};
const back = () => act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
const lineIds = () =>
  [...host.querySelectorAll("li[data-message-id]")].map((row) => row.getAttribute("data-message-id"));

describe("Messages from the server, on a client that starts empty", () => {
  it("lists a conversation written while the player was away, with its last line and unread; opens, reads and answers it", async () => {
    const inbox = await startEmpty(1);
    expect(tabs()).toEqual(["Global", "Messages1"]);

    await press("Messages");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.textContent).toContain("are you there");
    expect(rows()[0]!.textContent).toContain("1");

    await act(async () => rows()[0]!.querySelector("button")!.click());
    // Its history, read from the server on opening, under the line the list showed.
    expect(lineIds()).toEqual(["d1", "d2"]);
    expect(tabs()).toEqual(["Global", "Messages"]);
    // Told to the server, which recounts its unread: another device, or a reload, finds it read.
    expect(inbox.sent).toContainEqual({
      type: "direct:read",
      payload: { threadId: THREAD, messageId: "d2", readerId: SELF, readAt: expect.any(String) },
    });

    const field = host.querySelector<HTMLInputElement>('input[aria-label="Message"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "yes, at dawn");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
    expect(inbox.sent).toContainEqual(
      expect.objectContaining({
        type: "direct:message",
        payload: expect.objectContaining({ recipientId: ALDRIC, content: "yes, at dawn" }),
      }),
    );
  });

  it("keeps a conversation already read across a reload: listed, nothing unread, and nothing to tell on opening", async () => {
    const inbox = await startEmpty(0);
    expect(tabs()).toEqual(["Global", "Messages"]);
    await press("Messages");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.textContent).toContain("are you there");
    expect(rows()[0]!.querySelector(".ui-chip")).toBeNull();
    await act(async () => rows()[0]!.querySelector("button")!.click());
    expect(receipts(inbox)).toEqual([]);
  });

  it("opens Global alone: the game room the handshake allows, but the player is not shown, never opens", async () => {
    await startEmpty(0);
    expect(roomPaths()).toEqual([`/api/chat/rooms/${encodeURIComponent(GLOBAL_CHAT_CHANNEL_ID)}`]);
  });

  it("tells the server a message arriving while the conversation is open is read, and tells it once", async () => {
    const inbox = await startEmpty(1);
    await openConversation();
    await recounted(inbox, 0);
    await arrives(inbox, message("d3", ALDRIC, "dawn it is", 40), 1);
    expect(receipts(inbox)).toEqual(["d2", "d3"]);
    await act(async () => useRealtimeChatStore.getState().actions.markThreadAsRead(THREAD));
    expect(receipts(inbox)).toEqual(["d2", "d3"]);
  });

  it("gives nothing to a client replaced since: the old socket's frames are not the new client's", async () => {
    const inbox = await startEmpty(0);
    await act(async () => {
      useRealtimeChatStore.getState().actions.resetClient();
      useRealtimeChatStore.getState().actions.initializeClient({ baseUrl: BASE, rooms: [GLOBAL_ROOM.zoneId] });
    });
    await act(async () => inbox.receive(handshake(listing(3))));
    await arrives(inbox, message("d3", ALDRIC, "dawn it is", 40), 4);
    expect(useRealtimeChatStore.getState().dmThreads).toEqual({});
  });
});

describe("unread is the server's count, whatever part of the conversation the client holds", () => {
  it("60 unread, opened on a first page of 50: read through the newest, it clears, and stays clear on reconnect", async () => {
    const older = Array.from({ length: 49 }, (_, i) => ({
      ...message(`older-${i}`, ALDRIC, `older ${i}`, 0),
      createdAt: new Date(Date.UTC(2026, 10, 1, 12, 0, i)).toISOString(),
    }));
    const inbox = await startEmpty(60, {
      messages: [...older, HISTORY[1]!].reverse(),
      nextCursor: older[0]!.createdAt,
    });
    expect(tabs()).toEqual(["Global", "Messages60"]);

    await openConversation();
    expect(lineIds()).toHaveLength(50);
    expect(receipts(inbox)).toEqual(["d2"]);
    await recounted(inbox, 0);
    await back();
    expect(tabs()).toEqual(["Global", "Messages"]);
    expect(rows()[0]!.querySelector(".ui-chip")).toBeNull();

    await act(async () => inbox.receive(handshake(listing(0))));
    expect(tabs()).toEqual(["Global", "Messages"]);
  });

  it("210 lines over the socket while the room is shown, more than the 200 kept: 211 unread, then none once read", async () => {
    const inbox = await startEmpty(1);
    const live = Array.from({ length: 210 }, (_, i) => ({
      ...message(`live-${i}`, ALDRIC, `live ${i}`, 31),
      createdAt: new Date(Date.UTC(2026, 10, 1, 12, 31, i)).toISOString(),
    }));
    for (const [i, line] of live.entries()) await arrives(inbox, line, 2 + i);
    expect(useRealtimeChatStore.getState().dmThreads[THREAD]!.messages).toHaveLength(200);
    expect(tabs()).toEqual(["Global", "Messages211"]);

    await openConversation();
    expect(receipts(inbox)).toEqual(["live-209"]);
    await recounted(inbox, 0, live.at(-1));
    await back();
    expect(tabs()).toEqual(["Global", "Messages"]);

    await act(async () => inbox.receive(handshake(listing(0, live.at(-1)))));
    expect(tabs()).toEqual(["Global", "Messages"]);
    expect(rows()[0]!.textContent).toContain("live 209");
  });

  it("clears when the player reads on another device: the inbox's recount reaches this one, which tells nothing", async () => {
    const inbox = await startEmpty(1);
    expect(tabs()).toEqual(["Global", "Messages1"]);
    await recounted(inbox, 0);
    expect(tabs()).toEqual(["Global", "Messages"]);
    expect(receipts(inbox)).toEqual([]);
  });

  it("shows a line that came just before leaving as unread until the server answers the read, one round trip", async () => {
    const inbox = await startEmpty(1);
    await openConversation();
    await recounted(inbox, 0);
    await arrives(inbox, message("d3", ALDRIC, "dawn it is", 40), 1);
    expect(receipts(inbox)).toEqual(["d2", "d3"]);
    await back();
    expect(tabs()).toEqual(["Global", "Messages1"]);
    await recounted(inbox, 0, message("d3", ALDRIC, "dawn it is", 40));
    expect(tabs()).toEqual(["Global", "Messages"]);
  });

  it("takes a reconnect's handshake as it stands: a line that came while away, unread", async () => {
    const inbox = await startEmpty(0);
    await act(async () => inbox.receive(handshake(listing(1, message("d3", ALDRIC, "dawn it is", 40)))));
    expect(tabs()).toEqual(["Global", "Messages1"]);
    await press("Messages");
    expect(rows()[0]!.textContent).toContain("dawn it is");
    expect(useRealtimeChatStore.getState().dmThreads[THREAD]!.messages.map(({ id }) => id)).toEqual(["d2", "d3"]);
  });
});
