// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The app as it runs: its shell (which opens the one chat connection for a signed-in player), the lobby's chat, the real
// store and transport. Only the network stands in: the sockets, the server's answers, and the identity.
const session = vi.hoisted(() => ({
  current: { user: { id: "u7", realmsId: "0x7", name: "You" } } as { user: Record<string, string> } | null,
}));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: session.current ? "signed-in" : "signed-out", session: session.current }),
}));
vi.mock("@realms-world/identity", async (original) => ({
  ...(await original<typeof import("@realms-world/identity")>()),
  fetchIdentityProfiles: async (_origin: string, accounts: string[]) =>
    Object.fromEntries(accounts.map((account) => [account, { name: null, portrait: null }])),
}));
vi.mock("../account-runtime", () => ({ default: () => null }));

const { AppShell } = await import("../app-shell");
const { LobbyChat } = await import("./app-chat");
const { useRealtimeChatStore } = await import("@/ui/features/social/realtime-chat/model/store");
const { layOutChatLists } = await import("@/hooks/use-stick-to-latest.test-support");

const LOBBY = "slot:0x52:blitz-1630";
const SLOT = { chainId: "0x052", name: "blitz-1630" };

/** A socket the test drives, as a browser's: it opens, receives, and keeps what the client sent. */
class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static made: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  closed = false;
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
    this.closed = true;
    this.readyState = FakeSocket.CLOSED;
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.#listeners.get("open")?.forEach((listener) => listener({}));
  }
  receive(message: unknown) {
    this.#listeners.get("message")?.forEach((listener) => listener({ data: JSON.stringify(message) }));
  }
  /** The connection lost, as a network drops it: closed, not by the client. */
  drop() {
    this.readyState = FakeSocket.CLOSED;
    this.#listeners.get("close")?.forEach((listener) => listener({ wasClean: false, code: 1006, reason: "" }));
  }
}

const said = (id: string, playerId: string, displayName: string, content: string, minute: number) => ({
  id,
  zoneId: LOBBY,
  sender: { playerId, displayName },
  content,
  createdAt: new Date(Date.UTC(2026, 9, 8, 16, minute)).toISOString(),
});

/** The lobby room's history, newest first as the server pages it. */
let history = [said("b", "0x7", "You", "on my way", 2), said("a", "0x64", "Aldric", "gl hf", 1)];

let host: HTMLDivElement;
let root: Root;
let undoLayout: () => void;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.current = { user: { id: "u7", realmsId: "0x7", name: "You" } };
  history = [said("b", "0x7", "You", "on my way", 2), said("a", "0x64", "Aldric", "gl hf", 1)];
  FakeSocket.made = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input), "https://app.test");
      const body =
        url.pathname === "/api/chat/world"
          ? { messages: url.searchParams.get("zoneId") === LOBBY ? history : [], nextCursor: null }
          : { blocked: [], version: 0, profiles: {} };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  undoLayout = layOutChatLists();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  undoLayout();
  useRealtimeChatStore.getState().actions.resetClient();
  vi.unstubAllGlobals();
});

/** The app on a lobby's page (its chat), or on another page; `membership` as the lobby names it. */
const draw = (page: "lobby" | "elsewhere", membership = "0x4a1:false:0:false") =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <Routes>
            <Route element={<AppShell />}>
              <Route
                path="/"
                element={page === "lobby" ? <LobbyChat slot={SLOT} membership={membership} /> : <p>Play</p>}
              />
            </Route>
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );

const inboxes = () => FakeSocket.made.filter(({ url }) => url.endsWith("/api/chat/inbox"));
const inbox = () => inboxes().at(-1)!;
const lobbySockets = () => FakeSocket.made.filter(({ url }) => url.includes(encodeURIComponent(LOBBY)));
const lobbySocket = () => lobbySockets().at(-1)!;
/** The inbox's handshake, and the lobby's room saying whether the player writes there. */
const connect = async (canWrite: boolean) => {
  await act(async () => {
    inbox().open();
    inbox().receive({
      type: "connected",
      playerId: "0x7",
      displayName: "You",
      channels: ["world:global"],
      threads: [],
    });
  });
  await act(async () => {
    lobbySocket().open();
    lobbySocket().receive({ type: "joined:zone", zoneId: LOBBY, canWrite });
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
};
const tabs = () => [...host.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
/** Each message's words, as its row shows them. */
const lines = () =>
  [...host.querySelectorAll("li[data-message-id]")].map((row) => [...row.querySelectorAll("p")].at(-1)?.textContent);
const field = () => host.querySelector<HTMLInputElement>('input[aria-label="Message"]');
const type = async (text: string) => {
  const input = field()!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
};

it("opens the lobby's room on its page, first, on the app's one connection, and leaves it when the page goes", async () => {
  await draw("lobby");
  await connect(false);
  expect(tabs()).toEqual(["Lobby", "Global", "Messages"]);
  expect(lobbySockets()).toHaveLength(1);
  await draw("elsewhere");
  expect(lobbySocket().closed).toBe(true);
  // The one connection held: no second inbox.
  expect(inboxes()).toHaveLength(1);
});

it("reads the lobby's history and its room as one list, oldest first, each message once", async () => {
  await draw("lobby");
  await connect(false);
  await act(async () => lobbySocket().receive({ type: "world:message", zoneId: LOBBY, message: history[0] }));
  await act(async () =>
    lobbySocket().receive({ type: "world:message", zoneId: LOBBY, message: said("c", "0x65", "Corwin", "ready", 3) }),
  );
  expect(lines()).toEqual(["gl hf", "on my way", "ready"]);
});

it("lets a registered player write to the lobby's room, and takes the field away when the room refuses for want of registration", async () => {
  await draw("lobby");
  await connect(true);
  expect(host.textContent).not.toContain("Players registered in this Blitz write here.");
  await type("hold the east");
  expect(lobbySocket().sent.at(-1)).toMatchObject({
    type: "world:publish",
    zoneId: LOBBY,
    payload: { zoneId: LOBBY, content: "hold the east" },
  });
  await act(async () => lobbySocket().receive({ type: "error", code: "registration_required", message: "no" }));
  expect(field()).toBeNull();
  expect(host.textContent).toContain("Players registered in this Blitz write here.");
  // A room's refusal is no fault of the connection.
  expect(useRealtimeChatStore.getState().connectionStatus).toBe("connected");
});

it("tells a reader who may not write who writes there, and says an empty room is empty", async () => {
  history = [];
  await draw("lobby");
  await connect(false);
  expect(field()).toBeNull();
  expect(host.textContent).toContain("Players registered in this Blitz write here.");
  expect(host.textContent).toContain("No messages yet");
});

it("opens the room again when the registration changes, since the room decides its writers at the open", async () => {
  await draw("lobby");
  await connect(false);
  await draw("lobby", "0x4a1:true:500:false");
  expect(lobbySockets()).toHaveLength(2);
  await act(async () => {
    lobbySocket().open();
    lobbySocket().receive({ type: "joined:zone", zoneId: LOBBY, canWrite: true });
  });
  expect(field()).not.toBeNull();
});

it("says why a message was not taken, and takes it out of the list", async () => {
  await draw("lobby");
  await connect(true);
  await type("spam");
  expect(lines().some((line) => line?.includes("spam"))).toBe(true);
  await act(async () => lobbySocket().receive({ type: "error", code: "rate_limited", message: "slow" }));
  expect(host.textContent).toContain("Too fast. Wait a moment.");
  expect(lines().some((line) => line?.includes("spam"))).toBe(false);
});

/** The inbox's handshake on a connection opened again: it names Global only, never a lobby's room. */
const greetAgain = async () =>
  act(async () => {
    inbox().open();
    inbox().receive({
      type: "connected",
      playerId: "0x7",
      displayName: "You",
      channels: ["world:global"],
      threads: [],
    });
  });
/** Time passing on the transport's clock, for its reopen to come due. */
const wait = (ms: number) => act(async () => vi.advanceTimersByTime(ms));

describe.each([
  { membership: "registered", canWrite: true },
  { membership: "not registered", canWrite: false },
])("the lobby's room through a dropped connection, a player $membership", ({ canWrite }) => {
  /** The room as the player meets it: a field to write in, or the line saying who writes there. */
  const expectWriting = () => {
    if (canWrite) {
      expect(field()!.disabled).toBe(false);
      expect(host.textContent).not.toContain("Players registered in this Blitz write here.");
    } else {
      expect(field()).toBeNull();
      expect(host.textContent).toContain("Players registered in this Blitz write here.");
    }
  };
  /** A message arriving in the lobby's room, and, for a writer, one sent there on the socket that stands. */
  const expectLive = async (id: string, minute: number) => {
    await act(async () =>
      lobbySocket().receive({
        type: "world:message",
        zoneId: LOBBY,
        message: said(id, "0x65", "Corwin", `live ${id}`, minute),
      }),
    );
    expect(lines()).toContain(`live ${id}`);
    if (!canWrite) return;
    await type(`sent ${id}`);
    expect(lobbySocket().sent.at(-1)).toMatchObject({
      type: "world:publish",
      zoneId: LOBBY,
      payload: { content: `sent ${id}` },
    });
  };

  beforeEach(async () => {
    await draw("lobby", canWrite ? "0x4a1:true:500:false" : "0x4a1:false:0:false");
    await connect(canWrite);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => vi.useRealTimers());

  it("keeps the room as it was when only the inbox drops and comes back, on the same room socket", async () => {
    expectWriting();
    await act(async () => inbox().drop());
    await wait(1_000);
    expect(inboxes()).toHaveLength(2);
    await greetAgain();

    expectWriting();
    expect(lobbySockets()).toHaveLength(1);
    expect(lobbySocket().closed).toBe(false);
    await expectLive("i1", 10);
  });

  it("takes the room away while its own socket is down, and back once the room opens again", async () => {
    await act(async () => lobbySocket().drop());
    expect(field()?.disabled ?? true).toBe(true);
    await wait(1_000);
    expect(lobbySockets()).toHaveLength(2);
    await act(async () => {
      lobbySocket().open();
      lobbySocket().receive({ type: "joined:zone", zoneId: LOBBY, canWrite });
    });

    expectWriting();
    expect(inboxes()).toHaveLength(1);
    await expectLive("r1", 11);
  });
});

it("asks a signed-out player to sign in, and opens no chat at all", async () => {
  session.current = null;
  await draw("lobby");
  expect(host.textContent).toContain("Sign in to chat");
  expect(FakeSocket.made).toEqual([]);
});
