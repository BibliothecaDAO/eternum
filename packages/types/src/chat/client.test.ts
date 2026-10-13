import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RealtimeClient } from "./client";

/** A socket the test drives: it opens, receives and drops when told to, like a browser's. */
class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = FakeSocket.CONNECTING;
  closedByClient = false;
  readonly sent: string[] = [];
  readonly #listeners = new Map<string, Array<{ listener: (event: unknown) => void; once: boolean }>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: unknown) => void, options?: { once?: boolean }) {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), { listener, once: options?.once === true }]);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closedByClient = true;
    this.readyState = FakeSocket.CLOSED;
    this.#emit("close", { wasClean: true, reason: "" });
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.#emit("open", {});
  }

  receive(message: unknown) {
    this.#emit("message", { data: JSON.stringify(message) });
  }

  /** The connection is lost without anyone closing it. */
  drop() {
    this.readyState = FakeSocket.CLOSED;
    this.#emit("close", { wasClean: false, reason: "" });
  }

  #emit(type: string, event: unknown) {
    const listeners = this.#listeners.get(type) ?? [];
    this.#listeners.set(
      type,
      listeners.filter(({ once }) => !once),
    );
    listeners.forEach(({ listener }) => listener(event));
  }
}

const connect = () => {
  const sockets: FakeSocket[] = [];
  const closes: unknown[] = [];
  const messages: Array<{ type: string; zoneId?: unknown }> = [];
  let reconnecting = 0;
  const client = new RealtimeClient({
    baseUrl: "https://chat.realms.party?playerId=0xvictim",
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    onClose: (event) => closes.push(event),
    onMessage: (message) => messages.push(message),
    onReconnecting: () => (reconnecting += 1),
  });
  const paths = () => sockets.map(({ url }) => new URL(url).pathname);
  return { client, sockets, closes, messages, paths, reconnecting: () => reconnecting };
};

describe("RealtimeClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens the websocket without identity query parameters", () => {
    const { sockets } = connect();
    expect(sockets[0].url).toBe("wss://chat.realms.party/api/chat/inbox");
  });

  it("opens a dropped inbox again by itself, and says it is reconnecting", () => {
    const { sockets, closes, paths, reconnecting } = connect();
    sockets[0].open();
    sockets[0].drop();
    expect(closes).toHaveLength(1);
    expect(reconnecting()).toBe(1);
    expect(paths()).toEqual(["/api/chat/inbox"]);
    vi.advanceTimersByTime(1_000);
    expect(paths()).toEqual(["/api/chat/inbox", "/api/chat/inbox"]);
  });

  it("waits longer after each failure in a row, and starts over once a socket has opened", () => {
    const { sockets, paths } = connect();
    sockets[0].drop();
    vi.advanceTimersByTime(1_000);
    sockets[1].drop();
    vi.advanceTimersByTime(1_999);
    expect(paths()).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(paths()).toHaveLength(3);
    sockets[2].open();
    sockets[2].drop();
    vi.advanceTimersByTime(1_000);
    expect(paths()).toHaveLength(4);
  });

  it("opens a dropped room again, and leaves a room that was left on purpose closed", () => {
    const { client, sockets, messages, paths } = connect();
    sockets[0].open();
    sockets[0].receive({ type: "connected", playerId: "p", channels: ["world:global", "game:7"] });
    expect(paths()).toEqual(["/api/chat/inbox", "/api/chat/rooms/world%3Aglobal", "/api/chat/rooms/game%3A7"]);

    sockets[1].open();
    sockets[1].drop();
    expect(messages.at(-1)).toEqual({ type: "left:zone", zoneId: "world:global" });
    vi.advanceTimersByTime(1_000);
    expect(paths().at(-1)).toBe("/api/chat/rooms/world%3Aglobal");

    client.leaveZone("game:7");
    expect(sockets[2].closedByClient).toBe(false);
    sockets[2].open();
    expect(sockets[2].closedByClient).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(paths().filter((path) => path === "/api/chat/rooms/game%3A7")).toHaveLength(1);
  });

  it("stays closed once closed, and closes a socket still connecting only when it has opened", () => {
    const { client, sockets, closes, paths, reconnecting } = connect();
    client.close();
    // Closing a connecting socket at once is what a browser reports as an error for a mere cleanup.
    expect(sockets[0].closedByClient).toBe(false);
    sockets[0].open();
    expect(sockets[0].closedByClient).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(paths()).toEqual(["/api/chat/inbox"]);
    expect(closes).toEqual([]);
    expect(reconnecting()).toBe(0);
  });

  it("lets only the current inbox speak: a replaced socket's late close changes nothing", () => {
    const { client, sockets, closes, paths, reconnecting } = connect();
    sockets[0].open();
    // The inbox is closing; a message is sent, so a new inbox is opened for it at once.
    sockets[0].readyState = FakeSocket.CLOSING;
    client.send({ type: "direct:typing", payload: {} });
    expect(paths()).toEqual(["/api/chat/inbox", "/api/chat/inbox"]);
    sockets[1].open();
    expect(sockets[1].sent).toHaveLength(1);
    // The old socket finishes closing only now.
    sockets[0].drop();
    expect(closes).toEqual([]);
    expect(reconnecting()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(paths()).toHaveLength(2);
  });
});
