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

/**
 * The server, as its routes answer: the account's conversations (/api/chat/dm/threads: Aldric's, with his last line and
 * the unread the inbox counts), a conversation's history, the block list and the room's history.
 */
/** While set, the list's answer waits for it: a slow answer, released when the test says. */
let listHeld: Promise<void> | null = null;
const holdList = () => {
  let release = () => {};
  listHeld = new Promise<void>((resolve) => (release = resolve));
  return () =>
    act(async () => {
      release();
      listHeld = null;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
};

const serve = (unread: number, last: ReturnType<typeof message> = HISTORY[1]!, readThrough?: string) =>
  vi.fn(async (input: string | URL) => {
    const { pathname } = new URL(String(input));
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (pathname === "/api/chat/dm/threads") {
      if (listHeld) await listHeld;
      return json({
        threads: [
          {
            thread: {
              id: THREAD,
              participants: [SELF, ALDRIC],
              createdAt: at(1),
              updatedAt: last.createdAt,
              lastMessageId: last.id,
              unreadCounts: { [SELF]: unread },
              ...(readThrough ? { readThrough: { [SELF]: readThrough } } : {}),
              typing: [],
            },
            lastMessage: last,
          },
        ],
      });
    }
    if (pathname === `/api/chat/dm/threads/${THREAD}/messages`)
      return json({ messages: [...HISTORY].reverse(), nextCursor: null });
    if (pathname === "/api/chat/blocks") return json({ blocked: [] });
    if (pathname === "/api/chat/world") return json({ messages: [], nextCursor: null });
    return new Response("{}", { status: 404 });
  });

let host: HTMLDivElement;
let root: Root;
let undoLayout: () => void;

/**
 * A client starting empty, as a reload or a new device starts it: chat opened, the inbox's handshake naming Global and
 * a game room the player is not shown.
 */
const startEmpty = async (unread: number) => {
  vi.stubGlobal("fetch", serve(unread));
  useRealtimeChatStore.getState().actions.resetClient();
  await act(async () =>
    useRealtimeChatStore.getState().actions.initializeClient({ baseUrl: BASE, rooms: [GLOBAL_ROOM.zoneId] }),
  );
  await act(async () => root.render(<RealtimeChatShell rooms={[GLOBAL_ROOM]} />));
  const inbox = FakeSocket.made.at(-1)!;
  await act(async () => {
    inbox.open();
    inbox.receive({
      type: "connected",
      playerId: SELF,
      displayName: "You",
      channels: [GLOBAL_CHAT_CHANNEL_ID, "game:7"],
    });
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
    const lines = [...host.querySelectorAll("li[data-message-id]")].map((row) => row.getAttribute("data-message-id"));
    expect(lines).toEqual(["d1", "d2"]);
    expect(tabs()).toEqual(["Global", "Messages"]);
    // Told to the server, which clears its unread through it: another device, or a reload, finds it read.
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

  it("keeps a conversation already read across a reload: listed, nothing unread", async () => {
    await startEmpty(0);
    expect(tabs()).toEqual(["Global", "Messages"]);
    await press("Messages");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.textContent).toContain("are you there");
    expect(rows()[0]!.querySelector('[aria-label="unread"], .ui-chip')).toBeNull();
  });

  it("opens Global alone: the game room the handshake allows, but the player is not shown, never opens", async () => {
    await startEmpty(0);
    expect(roomPaths()).toEqual([`/api/chat/rooms/${encodeURIComponent(GLOBAL_CHAT_CHANNEL_ID)}`]);
  });

  it("tells the server a message arriving while the conversation is open is read, and tells it once", async () => {
    const inbox = await startEmpty(0);
    await press("Messages");
    await act(async () => rows()[0]!.querySelector("button")!.click());
    const arrived = message("d3", ALDRIC, "dawn it is", 40);
    await act(async () =>
      inbox.receive({ type: "direct:message", message: arrived, thread: { id: THREAD, participants: [SELF, ALDRIC] } }),
    );
    const receipts = () => inbox.sent.filter((frame) => frame.type === "direct:read");
    expect(receipts().map((frame) => (frame.payload as { messageId: string }).messageId)).toEqual(["d2", "d3"]);
    await act(async () => useRealtimeChatStore.getState().actions.markThreadAsRead(THREAD));
    expect(receipts()).toHaveLength(2);
  });
});

describe("a slow list, answered after what reached the client meanwhile", () => {
  /** The inbox's handshake again, as after a reconnect: the list is asked for again, and held. */
  const reconnectHeld = async (inbox: FakeSocket) => {
    const release = holdList();
    await act(async () =>
      inbox.receive({ type: "connected", playerId: SELF, displayName: "You", channels: [GLOBAL_CHAT_CHANNEL_ID] }),
    );
    return release;
  };
  const arrives = (inbox: FakeSocket, id: string, content: string, minute: number) =>
    act(async () =>
      inbox.receive({
        type: "direct:message",
        message: message(id, ALDRIC, content, minute),
        thread: { id: THREAD, participants: [SELF, ALDRIC], updatedAt: at(minute), lastMessageId: id },
      }),
    );
  const held = () => useRealtimeChatStore.getState().dmThreads[THREAD]!;

  it("keeps a message that came over the socket meanwhile: its unread, its line first in the list, its order", async () => {
    const inbox = await startEmpty(0);
    const release = await reconnectHeld(inbox);
    await arrives(inbox, "d3", "dawn it is", 40);
    expect(tabs()).toEqual(["Global", "Messages1"]);

    await release();
    expect(tabs()).toEqual(["Global", "Messages1"]);
    await press("Messages");
    expect(rows()[0]!.textContent).toContain("dawn it is");
    expect(rows()[0]!.textContent).toContain("1");
    expect(held().thread.lastMessageId).toBe("d3");
    expect(held().messages.map(({ id }) => id)).toEqual(["d2", "d3"]);
  });

  it("keeps a conversation read meanwhile read, though the list was read before and says unread", async () => {
    const inbox = await startEmpty(1);
    const release = await reconnectHeld(inbox);
    await arrives(inbox, "d3", "dawn it is", 40);
    await press("Messages");
    await act(async () => rows()[0]!.querySelector("button")!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());

    await release();
    expect(tabs()).toEqual(["Global", "Messages"]);
    expect(rows()[0]!.textContent).toContain("dawn it is");
    expect(rows()[0]!.querySelector(".ui-chip")).toBeNull();
    expect(held().messages.map(({ id }) => id)).toEqual(["d1", "d2", "d3"]);
  });

  it("keeps read what was read meanwhile, though the list counts it, and counts what the list adds unseen", async () => {
    // The client holds Aldric's "are you there", unread; the list asked for again already holds his next line too.
    const inbox = await startEmpty(1);
    vi.stubGlobal("fetch", serve(2, message("d3", ALDRIC, "dawn it is", 40)));
    const release = await reconnectHeld(inbox);
    await press("Messages");
    await act(async () => rows()[0]!.querySelector("button")!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click());
    expect(tabs()).toEqual(["Global", "Messages"]);

    await release();
    // "are you there" stays read; "dawn it is", which the client never showed, is the one unread.
    expect(tabs()).toEqual(["Global", "Messages1"]);
    expect(rows()[0]!.textContent).toContain("dawn it is");
    expect(rows()[0]!.querySelector(".ui-chip")?.textContent).toBe("1");
    expect(held().messages.map(({ id }) => id)).toEqual(["d1", "d2", "d3"]);
  });

  it("counts from where the server says the player read, when that is past what was read here", async () => {
    const inbox = await startEmpty(0);
    // Read on another device through "are you there": the list's one unread is the line after it.
    vi.stubGlobal("fetch", serve(1, message("d3", ALDRIC, "dawn it is", 40), at(30)));
    const release = await reconnectHeld(inbox);
    await release();
    expect(tabs()).toEqual(["Global", "Messages1"]);
  });

  it("gives nothing to a client replaced while the list was on its way", async () => {
    const inbox = await startEmpty(0);
    const release = await reconnectHeld(inbox);
    await act(async () => {
      useRealtimeChatStore.getState().actions.resetClient();
      useRealtimeChatStore.getState().actions.initializeClient({ baseUrl: BASE, rooms: [GLOBAL_ROOM.zoneId] });
    });
    await release();
    expect(useRealtimeChatStore.getState().dmThreads).toEqual({});
    expect(useRealtimeChatStore.getState().unreadDirectTotal).toBe(0);
  });
});
