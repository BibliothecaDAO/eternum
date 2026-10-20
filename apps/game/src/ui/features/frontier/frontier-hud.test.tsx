// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The real Frontier HUD on the lab's game. Only the network, the identity and the chat pane's own drawing stand in: the
// HUD, its hooks and the stores are the real ones.
const wire = vi.hoisted(() => ({ made: 0, close: vi.fn() }));
vi.mock("@bibliothecadao/types", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/types")>()),
  RealtimeClient: class {
    constructor() {
      wire.made += 1;
    }
    close = wire.close;
  },
}));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({
    status: "signed-in",
    session: { user: { id: "u1", realmsId: "", name: "uxplay", email: "uxplay@example.com", address: "0x7" } },
  }),
}));
vi.mock("@/shell/sign-in/sign-in-route", () => ({ useRequestSignIn: () => vi.fn() }));
vi.mock("@/ui/features/social", async () => ({
  ...(await import("@/ui/features/social/realtime-chat/hooks/use-realtime-chat")),
  RealtimeChatShell: () => <input aria-label="Message" />,
}));

const { readExpeditionRules } = await import("@bibliothecadao/eternum");
const { useRealtimeChatStore } = await import("@/ui/features/social/realtime-chat/model/store");
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { FrontierHud } = await import("./frontier-hud");

/** The frame's width, as the layout reads it: a desktop from 1024 px, told to the layout when it changes. */
const viewport = (() => {
  let width = 1440;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity) <= width;
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
  }));
  return {
    set: (next: number) => {
      width = next;
      listeners.forEach((listener) => listener());
    },
  };
})();

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ blocked: [] }), { status: 200 })),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** What the page shows of chat: whether the client is connected, and the unread count where the layout shows it. */
const chatReading = () => ({
  connected: useRealtimeChatStore.getState().client !== null,
  unread:
    host.querySelector('[aria-label^="Unread chat messages"]')?.textContent ??
    [...host.querySelectorAll('nav[aria-label="Places"] button')]
      .find((button) => button.textContent?.includes("Chat"))
      ?.textContent?.replace("Chat", "") ??
    null,
});

/** The real Frontier HUD over the lab's game, which shard rules the realm's labor. */
const renderHud = () =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <LabGame preset={5} facts={() => [LABOR_RULES]}>
            {(store) => <FrontierHud rules={readExpeditionRules(store, 1)!} />}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );

const LABOR_RULES = {
  model: "LaborRules",
  key: "0x1ab",
  value: { game_id: 1, amount: "1000", account_daily_limit: 5 },
};

it("opens Realms from a desktop realm panel whose Realms have no labor waiting, so a new player can add one", async () => {
  viewport.set(1440);
  await renderHud();
  const realms = [...host.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === "Realms");
  expect(realms).toBeDefined();
  await act(async () => realms!.click());
  expect(host.querySelector('form[aria-label="Add a Realm"]')).not.toBeNull();
});

it("keeps one chat connection and its unread count from desktop to phone and back, through the Frontier HUD", async () => {
  viewport.set(1440);
  wire.made = 0;
  wire.close.mockClear();
  await renderHud();
  await act(async () => useRealtimeChatStore.setState({ unreadWorldTotal: 3 }));
  expect(chatReading()).toEqual({ connected: true, unread: "3" });

  await act(async () => viewport.set(390));
  expect(chatReading()).toEqual({ connected: true, unread: "3" });

  await act(async () => viewport.set(1440));
  expect(chatReading()).toEqual({ connected: true, unread: "3" });
  // One connection for the game: the layout changes swap the views that read it, never the connection.
  expect(wire.made).toBe(1);
  expect(wire.close).not.toHaveBeenCalled();
});

it("gives a phone the Events' Log on its place bar, with the filter the desktop's Events have, and closes it", async () => {
  viewport.set(390);
  await renderHud();
  const log = () =>
    [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')].find((button) =>
      button.textContent?.endsWith("Log"),
    );
  expect(log()).toBeDefined();
  expect(document.querySelector('[aria-label="Event log"]')).toBeNull();
  await act(async () => log()!.click());
  const window = document.querySelector('[aria-label="Event log"]');
  expect(window).not.toBeNull();
  expect([...window!.querySelectorAll("button")].map((button) => button.textContent)).toEqual(
    expect.arrayContaining(["Important", "Mine", "All"]),
  );
  expect(log()!.getAttribute("aria-current")).toBe("page");
  // The Log is a phone's bottom sheet over the place bar: its own close takes it away.
  await act(async () => window!.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
  expect(document.querySelector('[aria-label="Event log"]')).toBeNull();
  expect(log()!.getAttribute("aria-current")).toBeNull();
});
