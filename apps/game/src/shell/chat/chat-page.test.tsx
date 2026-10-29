// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The app's own pages and frame, signed in or not; the chat's sockets never answer, and the store is the real one.
const session = vi.hoisted(() => ({
  current: { user: { id: "u7", realmsId: "0x7", name: "You", image: null } } as unknown,
}));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: session.current ? "signed-in" : "signed-out", session: session.current }),
}));
vi.mock("../account-runtime", () => ({ default: () => null }));

const { appRoutes } = await import("@/app");
const { setViewportWidth } = await import("../frame/test-viewport");
const { useRealtimeChatStore } = await import("@/ui/features/social/realtime-chat/model/store");
const { GLOBAL_CHAT_CHANNEL_ID } = await import("@bibliothecadao/types");
const { layOutChatLists } = await import("@/hooks/use-stick-to-latest.test-support");
const { useAppChatPlace } = await import("./app-chat-place");

class SilentSocket {
  readyState = 0;
  addEventListener() {}
  send() {}
  close() {}
}

let root: Root | null = null;
let host: HTMLDivElement;
let undoLayout: () => void;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.current = { user: { id: "u7", realmsId: "0x7", name: "You", image: null } };
  vi.stubGlobal("WebSocket", SilentSocket);
  vi.stubGlobal("fetch", () => new Promise<Response>(() => {}));
  undoLayout = layOutChatLists();
  host = document.createElement("div");
  document.body.replaceChildren(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  useRealtimeChatStore.getState().actions.resetClient();
  // The pane as a new visit finds it: closed.
  useAppChatPlace.setState({ paneOpen: false });
  undoLayout();
  vi.unstubAllGlobals();
});

const open = async (path: string, width: number) => {
  setViewportWidth(width);
  root = createRoot(host);
  await act(async () =>
    root!.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>{appRoutes}</Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  for (let tick = 0; tick < 20 && !host.querySelector("[data-band]"); tick += 1)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
};

const place = (word: string) =>
  [...host.querySelectorAll<HTMLElement>('[data-role="tab"]')].find((tab) => tab.textContent?.includes(word));

/** Every chat drawn now, by its tabs: one list per chat on screen. */
const chats = () =>
  [...host.querySelectorAll('[data-hud-mode="app"] [role="tablist"]')].map((list) =>
    [...list.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent),
  );
const shellOpen = () => useRealtimeChatStore.getState().isShellOpen;
/** The chat connected, as its server answers: the player, Global joined, nobody muted. */
const connected = () =>
  act(() =>
    useRealtimeChatStore.setState({
      connectionStatus: "connected",
      identity: { playerId: "0x7", displayName: "You" },
      joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID],
      blockList: { blocked: [], version: 0 },
    }),
  );
/** A message from another player arriving in Global. */
const arrives = (id: string) =>
  act(() =>
    useRealtimeChatStore.getState().actions.receiveWorldMessage(GLOBAL_CHAT_CHANNEL_ID, {
      id,
      zoneId: GLOBAL_CHAT_CHANNEL_ID,
      sender: { playerId: "0x64", displayName: "Aldric" },
      content: `hello ${id}`,
      createdAt: new Date().toISOString(),
    } as never),
  );
const resize = (width: number) => act(() => setViewportWidth(width));

describe("chat in the app, on a phone", () => {
  it("is a tab of its own, its unread counted on it; pressed, it opens the page the chat fills", async () => {
    await open("/", 390);
    act(() => useRealtimeChatStore.setState({ unreadWorldTotal: 3 }));
    expect(place("Chat")!.querySelector("[data-count]")!.textContent).toBe("3");

    act(() => place("Chat")!.click());
    expect(place("Chat")!.getAttribute("aria-current")).toBe("page");
    expect(chats()).toEqual([["Global", "Messages"]]);
    // The chat fills the page: no footer under it.
    expect(host.querySelector('[data-band="footer"]')).toBeNull();
    expect(shellOpen()).toBe(true);
  });

  it("asks a player not signed in to sign in, and opens no chat", async () => {
    session.current = null;
    await open("/chat", 390);
    expect(host.querySelector('[data-band="body"]')!.textContent).toContain("Sign in to chat");
    expect(useRealtimeChatStore.getState().client).toBeNull();
  });
});

describe("chat in the app, page or pane, never both", () => {
  it("keeps Chat's page, one chat and open, when the phone's window grows to a desktop's", async () => {
    await open("/", 390);
    act(() => place("Chat")!.click());
    await resize(1440);
    expect(host.querySelector('[data-band="bar"]')).not.toBeNull();
    expect(chats()).toEqual([["Global", "Messages"]]);
    expect(host.querySelector('section[aria-label="Chat"]')).toBeNull();
    expect(place("Chat")!.getAttribute("aria-current")).toBe("page");
    expect(shellOpen()).toBe(true);

    // The bar's Chat there is the place the player is: pressed, still one chat.
    act(() => place("Chat")!.click());
    expect(chats()).toEqual([["Global", "Messages"]]);
    expect(shellOpen()).toBe(true);
  });

  it("draws Chat's page alone on a desktop, read as open: what arrives in the room shown counts nothing", async () => {
    await open("/chat", 1440);
    connected();
    expect(chats()).toEqual([["Global", "Messages"]]);
    // The bar's Chat, pressed there, and Escape: still the one chat, still open.
    act(() => place("Chat")!.click());
    expect(chats()).toEqual([["Global", "Messages"]]);
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(chats()).toEqual([["Global", "Messages"]]);
    expect(shellOpen()).toBe(true);

    arrives("a1");
    expect(chats()).toEqual([["Global", "Messages"]]);
    expect(useRealtimeChatStore.getState().unreadWorldTotal).toBe(0);
  });

  it("opens the pane over Play from the bar, reading what was counted, and closes it with Escape: then chat is closed", async () => {
    await open("/", 1440);
    connected();
    arrives("a1");
    arrives("a2");
    expect(place("Chat")!.querySelector("[data-count]")!.textContent).toBe("2");
    expect(chats()).toEqual([]);

    act(() => place("Chat")!.click());
    const pane = host.querySelector('section[aria-label="Chat"]')!;
    // Over Play, which stays: the pane is no page of its own.
    expect(host.querySelector('[data-band="body"]')!.textContent).not.toContain("Global");
    expect(pane.querySelector('[data-hud-mode="app"]')).not.toBeNull();
    expect(chats()).toEqual([["Global", "Messages"]]);
    expect(place("Chat")!.getAttribute("aria-current")).toBe("page");
    expect(shellOpen()).toBe(true);
    // Global, shown, is read.
    expect(place("Chat")!.querySelector("[data-count]")).toBeNull();

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(chats()).toEqual([]);
    expect(shellOpen()).toBe(false);
    arrives("a3");
    expect(place("Chat")!.querySelector("[data-count]")!.textContent).toBe("1");
  });
});
