// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The real Frontier HUD on the lab's game, with the real chat in it: only the network and the identity stand in. The
// chat's socket keeps what it is handed to send.
const wire = vi.hoisted(() => ({ sent: [] as unknown[] }));
vi.mock("@bibliothecadao/types", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/types")>()),
  RealtimeClient: class {
    close() {}
    send(frame: unknown) {
      wire.sent.push(frame);
    }
  },
}));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({
    status: "signed-in",
    session: { user: { id: "u1", realmsId: "", name: "uxplay", email: "uxplay@example.com", address: "0x7" } },
  }),
}));
vi.mock("@/shell/sign-in/connect", () => ({ useRequestSignIn: () => vi.fn() }));

const { GLOBAL_CHAT_CHANNEL_ID } = await import("@bibliothecadao/types");
const { getEntityName, readExpeditionRules } = await import("@bibliothecadao/eternum");
const { useRealtimeChatStore } = await import("@/ui/features/social/realtime-chat/model/store");
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { layOutChatLists } = await import("@/hooks/use-stick-to-latest.test-support");
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

const REALM = 7;
let host: HTMLDivElement;
let root: Root;
let undoLayout: () => void;
let realmName = "";

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  wire.sent.length = 0;
  undoLayout = layOutChatLists();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ blocked: [], version: 0, messages: [], nextCursor: null }), { status: 200 }),
    ),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  undoLayout();
  act(() => useUIStore.getState().selectOnMap(null));
});

const LABOR_RULES = {
  model: "LaborRules",
  key: "0x1ab",
  value: { game_id: 1, amount: "1000", campaign_essence: "0", golden_amount: "1000", golden_essence: "0" },
};

/** The real Frontier HUD over the lab's game. */
const renderHud = async (width: number) => {
  viewport.set(width);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <LabGame preset={5} facts={() => [LABOR_RULES]}>
            {(store) => {
              realmName = getEntityName(REALM, store)!;
              return <FrontierHud rules={readExpeditionRules(store, 1)!} />;
            }}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
};

/** The chat's handshake as it lands: connected, Global joined. */
const connect = () =>
  act(async () =>
    useRealtimeChatStore.setState({
      connectionStatus: "connected",
      identity: { playerId: "0x7", displayName: "uxplay" },
      joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID],
    }),
  );

const share = () => host.querySelector<HTMLButtonElement>('button[aria-label="Share the selected place"]');
const sendWithPlace = async (words: string) => {
  await act(async () => share()!.click());
  expect(host.querySelector("form [data-place]")?.textContent).toBe(realmName);
  const field = host.querySelector<HTMLInputElement>('input[aria-label="Message"]')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, words);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => host.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click());
  expect(wire.sent.at(-1)).toMatchObject({
    type: "world:publish",
    zoneId: GLOBAL_CHAT_CHANNEL_ID,
    payload: {
      content: words,
      metadata: {
        place: expect.objectContaining({
          kind: "structure",
          entityId: REALM,
          game: { chainId: "0x1ab", gameId: 1, name: "Lab" },
          name: realmName,
        }),
      },
    },
  });
};

it("shares the realm a phone player selected before opening Chat from the place bar, its card put away", async () => {
  await renderHud(390);
  await act(async () => useUIStore.getState().selectOnMap({ kind: "structure", entityId: REALM }));
  const chat = [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')].find((button) =>
    button.textContent?.includes("Chat"),
  )!;
  await act(async () => chat.click());
  await connect();
  // One panel at a time: Chat put the realm's card away, and kept the realm to share.
  expect(useUIStore.getState().mapSelection).toBeNull();
  expect(share()?.disabled).toBe(false);
  await sendWithPlace("hold here");
});

it("drops what Chat kept once the player picks again: a bare tile is nothing to share", async () => {
  await renderHud(390);
  await act(async () => useUIStore.getState().selectOnMap({ kind: "structure", entityId: REALM }));
  const chat = [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')].find((button) =>
    button.textContent?.includes("Chat"),
  )!;
  await act(async () => chat.click());
  await act(async () => useUIStore.getState().selectOnMap({ kind: "hex", hex: { col: 1, row: 1 } }));
  // The tap on the map put the page away; open Chat again, and the bare tile shares nothing.
  const again = [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')].find((button) =>
    button.textContent?.includes("Chat"),
  )!;
  await act(async () => again.click());
  await connect();
  expect(share()?.disabled).toBe(true);
});

it("shares the realm a desktop player selected, chat opened from its strip beside the map", async () => {
  await renderHud(1440);
  await act(async () => useUIStore.getState().selectOnMap({ kind: "structure", entityId: REALM }));
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Chat strip"]')!.click());
  await connect();
  expect(useUIStore.getState().mapSelection).toEqual({ kind: "structure", entityId: REALM });
  expect(share()?.disabled).toBe(false);
  await sendWithPlace("meet here");
});
