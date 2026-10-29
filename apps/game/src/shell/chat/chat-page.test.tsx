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

class SilentSocket {
  readyState = 0;
  addEventListener() {}
  send() {}
  close() {}
}

let root: Root | null = null;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.current = { user: { id: "u7", realmsId: "0x7", name: "You", image: null } };
  vi.stubGlobal("WebSocket", SilentSocket);
  vi.stubGlobal("fetch", () => new Promise<Response>(() => {}));
  host = document.createElement("div");
  document.body.replaceChildren(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  useRealtimeChatStore.getState().actions.resetClient();
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
/** The chat as the page shows it: inside the app's colours, its tabs. */
const chatTabs = () => [...host.querySelectorAll('[data-hud-mode="app"] [role="tab"]')].map((tab) => tab.textContent);

describe("chat in the app, on a phone", () => {
  it("is a tab of its own, its unread counted on it, leading to a page the chat fills, in the app's colours", async () => {
    await open("/", 390);
    act(() => useRealtimeChatStore.setState({ unreadWorldTotal: 3 }));
    expect(place("Chat")!.querySelector("[data-count]")!.textContent).toBe("3");
    expect(place("Chat")!.getAttribute("href")).toBe("/chat");

    await act(async () => root!.unmount());
    await open("/chat", 390);
    expect(place("Chat")!.getAttribute("aria-current")).toBe("page");
    expect(chatTabs()).toEqual(["Global", "Messages"]);
    // The chat fills the page: no footer under it.
    expect(host.querySelector('[data-band="footer"]')).toBeNull();
    expect(useRealtimeChatStore.getState().isShellOpen).toBe(true);
  });

  it("asks a player not signed in to sign in, and opens no chat", async () => {
    session.current = null;
    await open("/chat", 390);
    expect(host.querySelector('[data-band="body"]')!.textContent).toContain("Sign in to chat");
    expect(useRealtimeChatStore.getState().client).toBeNull();
  });
});

describe("chat in the app, on a desktop", () => {
  it("opens from the bar over the page, its unread counted there, and closes with Escape", async () => {
    await open("/", 1440);
    act(() => useRealtimeChatStore.setState({ unreadWorldTotal: 2 }));
    const chat = place("Chat")!;
    expect(chat.querySelector("[data-count]")!.textContent).toBe("2");
    expect(host.querySelector('section[aria-label="Chat"]')).toBeNull();

    act(() => chat.click());
    const pane = host.querySelector('section[aria-label="Chat"]')!;
    // Over Play, which stays: the pane is no page of its own.
    expect(host.querySelector('[data-band="body"]')!.textContent).not.toContain("Global");
    expect(pane.querySelector('[data-hud-mode="app"]')).not.toBeNull();
    expect(chatTabs()).toEqual(["Global", "Messages"]);
    expect(place("Chat")!.getAttribute("aria-current")).toBe("page");

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(host.querySelector('section[aria-label="Chat"]')).toBeNull();
  });
});
