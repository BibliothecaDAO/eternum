// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@realms-world/identity", async (original) => ({
  ...(await original<typeof import("@realms-world/identity")>()),
  fetchIdentityProfiles: async (_origin: string, accounts: string[]) =>
    Object.fromEntries(accounts.map((account) => [account, { name: null, portrait: null }])),
}));
// The game's players to mention need a game; these read rows, replies and links, with no one to mention.
vi.mock("../hooks/use-chat-mentions", () => ({ useChatMentions: () => ({ me: null, choices: [], names: [] }) }));

import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { layOutChatLists } from "@/hooks/use-stick-to-latest.test-support";
import { GLOBAL_ROOM } from "../model/chat-rooms";
import { useRealtimeChatStore } from "../model/store";
import type { DirectMessage, WorldChatMessage } from "../model/types";
import { RealtimeChatShell } from "./realtime-chat-shell";

const SELF = "0x7";
const ALDRIC = "0xa1d";
const CORWIN = "0xc0";
const THREAD = `${SELF}|${ALDRIC}`;
const DOCS = "https://docs.realms.party/frontier/expedition";
const VIDEO = "https://www.youtube.com/watch?v=ruin-run";

const said = (id: string, playerId: string, minute: number, content: string, metadata?: object): WorldChatMessage =>
  ({
    id,
    zoneId: GLOBAL_CHAT_CHANNEL_ID,
    sender: { playerId, displayName: playerId === ALDRIC ? "Aldric" : "Corwin" },
    content,
    createdAt: new Date(Date.UTC(2026, 9, 28, 12, minute)).toISOString(),
    ...(metadata ? { metadata } : {}),
  }) as WorldChatMessage;

const sendWorldMessage = vi.fn(() => Promise.resolve());
const sendDirectMessage = vi.fn(() => Promise.resolve());
const scrolledTo: string[] = [];

/** Global, as a busy evening reads it; and a conversation with Aldric. No socket, no fetch. */
const install = () => {
  const { actions } = useRealtimeChatStore.getState();
  const room = [
    said("m1", ALDRIC, 0, "does exploring give labor?"),
    said("m2", ALDRIC, 2, "or only the camps?"),
    said("m3", CORWIN, 3, "sent 1,200 knights, 3,046 left at home"),
    said("m4", CORWIN, 4, "camps and rifts", {
      replyTo: { id: "m1", playerId: ALDRIC, excerpt: "does exploring give labor?" },
    }),
    said("m5", ALDRIC, 20, `read ${DOCS} and ${VIDEO}`),
  ];
  const whisper: DirectMessage = {
    id: "d1",
    threadId: THREAD,
    senderId: ALDRIC,
    recipientId: SELF,
    content: "merge armies tomorrow?",
    createdAt: new Date(Date.UTC(2026, 9, 28, 12, 30)).toISOString(),
  };
  useRealtimeChatStore.setState({
    connectionStatus: "connected",
    identity: { playerId: SELF, displayName: "You" },
    joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID],
    activeZoneId: GLOBAL_CHAT_CHANNEL_ID,
    activeThreadId: undefined,
    worldZones: {
      [GLOBAL_CHAT_CHANNEL_ID]: {
        zoneId: GLOBAL_CHAT_CHANNEL_ID,
        messages: room,
        unreadCount: 0,
        hasMoreHistory: false,
        lastFetchedCursor: null,
        isFetchingHistory: false,
        pendingMessages: [],
      },
    },
    dmThreads: {
      [THREAD]: {
        thread: { id: THREAD, participants: [SELF, ALDRIC], createdAt: new Date(0).toISOString(), unreadCounts: {} },
        messages: [whisper],
        hasMoreHistory: false,
        lastFetchedCursor: undefined,
        isFetchingHistory: false,
        pendingMessages: [],
      },
    },
    onlinePlayers: { [ALDRIC]: { playerId: ALDRIC, displayName: "Aldric", isOnline: true, isTypingInThreadIds: [] } },
    view: { kind: "room", zoneId: GLOBAL_CHAT_CHANNEL_ID },
    actions: {
      ...actions,
      initializeClient: () => undefined,
      resetClient: () => undefined,
      loadWorldHistory: () => Promise.resolve(),
      loadDirectHistory: () => Promise.resolve(),
      sendWorldMessage,
      sendDirectMessage,
    },
  });
};

let host: HTMLDivElement;
let root: Root;
let undoLayout: () => void;
const opened = vi.fn();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  undoLayout = layOutChatLists();
  sendWorldMessage.mockClear();
  sendDirectMessage.mockClear();
  opened.mockClear();
  scrolledTo.length = 0;
  vi.stubGlobal("open", opened);
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolledTo.push(this.getAttribute("data-message-id") ?? "");
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  install();
  act(() => root.render(<RealtimeChatShell rooms={[GLOBAL_ROOM]} />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  undoLayout();
  vi.unstubAllGlobals();
});

const row = (id: string) => host.querySelector<HTMLElement>(`li[data-message-id="${id}"]`)!;
/** The run head's name over a message, if it starts a run. */
const runName = (id: string) => row(id).querySelector("p button")?.textContent ?? null;
const words = (id: string) => [...row(id).querySelectorAll("p")].at(-1)?.textContent;
const buttonIn = (element: Element, text: string) =>
  [...element.querySelectorAll("button")].find((button) => button.textContent === text);
const field = () => host.querySelector<HTMLInputElement>('input[aria-label="Message"]')!;
const type = (text: string) =>
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(field(), text);
    field().dispatchEvent(new Event("input", { bubbles: true }));
  });
const send = () => act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());

describe("a room's messages", () => {
  it("draws a sender's run under one name and time, and starts a run for a new sender, a gap and a reply", () => {
    expect(runName("m1")).toBe("Aldric");
    expect(runName("m2")).toBeNull();
    expect(runName("m3")).toBe("Corwin");
    expect(runName("m4")).toBe("Corwin");
    expect(runName("m5")).toBe("Aldric");
    expect(host.textContent).not.toMatch(/<Aldric>|\[\d\d:\d\d\]/);
  });

  it("leaves numbers as words: no place, no button in them", () => {
    expect(words("m3")).toBe("sent 1,200 knights, 3,046 left at home");
    expect(row("m3").querySelectorAll("p:last-of-type button, p:last-of-type a")).toHaveLength(0);
  });

  it("quotes what a reply answers over it, and shows that message when the quote is pressed", () => {
    const quote = row("m4").querySelector("button")!;
    expect(quote.textContent).toBe("Aldricdoes exploring give labor?");
    act(() => quote.click());
    expect(scrolledTo).toEqual(["m1"]);
    expect(row("m1").className).toContain("bg-hud-hover");
  });

  it("answers a message: its sender and words over the field, then sent with the reply, the field free again", async () => {
    act(() => buttonIn(row("m2"), "Reply")!.click());
    const bar = host.querySelector("form")!.firstElementChild!;
    expect(bar.textContent).toContain("Aldric");
    expect(bar.textContent).toContain("or only the camps?");
    type("only the camps");
    await send();
    expect(sendWorldMessage).toHaveBeenCalledWith(GLOBAL_CHAT_CHANNEL_ID, {
      content: "only the camps",
      zoneId: GLOBAL_CHAT_CHANNEL_ID,
      metadata: { replyTo: { id: "m2", playerId: ALDRIC, excerpt: "or only the camps?" } },
    });
    expect(host.querySelector("form")!.textContent).not.toContain("or only the camps?");
  });

  it("puts a reply away with its cross, and sends what follows as a plain message", async () => {
    act(() => buttonIn(row("m2"), "Reply")!.click());
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Cancel the reply"]')!.click());
    type("hello");
    await send();
    expect(sendWorldMessage).toHaveBeenCalledWith(GLOBAL_CHAT_CHANNEL_ID, {
      content: "hello",
      zoneId: GLOBAL_CHAT_CHANNEL_ID,
    });
  });

  it("answers a message swiped right on a phone", () => {
    const at = (type: string, x: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 100 });
      Object.defineProperty(event, "pointerType", { value: "touch" });
      return event;
    };
    act(() => {
      row("m3").dispatchEvent(at("pointerdown", 20));
      row("m3").dispatchEvent(at("pointerup", 100));
    });
    expect(host.querySelector("form")!.textContent).toContain("sent 1,200 knights");
  });
});

describe("links", () => {
  const link = (host_: string) =>
    [...row("m5").querySelectorAll("a")].find((anchor) => new URL(anchor.href).host === host_)!;

  it("opens a Realms site at once, in a new tab", () => {
    expect(link("docs.realms.party").textContent).toBe("docs.realms.party/frontier/expedition");
    act(() => link("docs.realms.party").click());
    expect(opened).toHaveBeenCalledWith(DOCS, "_blank", "noopener,noreferrer");
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it("asks before leaving Realms, the whole address shown, and opens only on Open", () => {
    act(() => link("www.youtube.com").click());
    const asking = host.querySelector('[role="dialog"]')!;
    expect(asking.getAttribute("aria-label")).toBe("Leaving Realms");
    expect(asking.textContent).toContain(VIDEO);
    expect(opened).not.toHaveBeenCalled();
    act(() => buttonIn(document.body, "Cancel")!.click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(opened).not.toHaveBeenCalled();
    act(() => link("www.youtube.com").click());
    act(() => buttonIn(document.body, "Open")!.click());
    expect(opened).toHaveBeenCalledWith(VIDEO, "_blank", "noopener,noreferrer");
  });
});

describe("a conversation's messages", () => {
  it("answers a private message with the reply, through the private channel", async () => {
    act(() => useRealtimeChatStore.getState().actions.openConversation(ALDRIC));
    act(() => buttonIn(row("d1"), "Reply")!.click());
    type("yes, at dawn");
    await send();
    expect(sendDirectMessage).toHaveBeenCalledWith(THREAD, ALDRIC, "yes, at dawn", {
      replyTo: { id: "d1", playerId: ALDRIC, excerpt: "merge armies tomorrow?" },
    });
  });
});
