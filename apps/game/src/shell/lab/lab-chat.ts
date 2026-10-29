import { GLOBAL_CHAT_CHANNEL_ID, isLobbyRoom, type WorldChatMessage } from "@bibliothecadao/types";

import { LAB_SESSION } from "./app-lab-fixtures";

/**
 * The chat server, answered in the tab, as the chat Worker answers it: its sockets and its reads. The inbox greets the
 * lab's player with the rooms they may join: the world's and `gameRooms`. A room admits them to the zone its address
 * names, with whether they write (a Blitz lobby's room when `lobbyWrites`, as it answers a player registered in its
 * slot; any other room always), and echoes what they send as the room would broadcast it. A room's history is
 * `history(zoneId)` (none by default), and the player mutes nobody. Any other socket or read goes on as before; the
 * returned function puts both back.
 */
export const answerLabChat = ({
  lobbyWrites = false,
  gameRooms = [],
  history = () => [],
}: {
  lobbyWrites?: boolean;
  gameRooms?: readonly string[];
  history?: (zoneId: string) => readonly WorldChatMessage[];
}) => {
  const Network = window.WebSocket;
  const network = window.fetch.bind(window);
  const previousFetch = window.fetch;
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.pathname === "/api/chat/world")
      return Promise.resolve(
        Response.json({ messages: history(url.searchParams.get("zoneId") ?? ""), nextCursor: null }),
      );
    if (url.pathname === "/api/chat/blocks") return Promise.resolve(Response.json({ blocked: [], version: 0 }));
    return network(input, init);
  };
  const player = { playerId: LAB_SESSION.user.realmsId, displayName: LAB_SESSION.user.name };
  class LabInbox extends EventTarget {
    readyState = 1;
    constructor() {
      super();
      setTimeout(
        () => this.#emit({ type: "connected", ...player, channels: [GLOBAL_CHAT_CHANNEL_ID, ...gameRooms] }),
        50,
      );
    }
    send() {}
    close() {
      this.readyState = 3;
    }
    #emit(body: unknown) {
      this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(body) }));
    }
  }
  class LabRoom extends EventTarget {
    readyState = 1;
    #zoneId: string;
    constructor(zoneId: string) {
      super();
      this.#zoneId = zoneId;
      const canWrite = !isLobbyRoom(zoneId) || lobbyWrites;
      setTimeout(() => this.#emit({ type: "joined:zone", zoneId, canWrite }), 50);
    }
    send(data: string) {
      const sent = JSON.parse(data) as { type: string; payload: { content: string }; clientMessageId?: string };
      // A room broadcasts what is published in it; what the page says it shows (room:seen) it only keeps.
      if (sent.type !== "world:publish") return;
      const message = {
        id: sent.clientMessageId ?? String(Date.now()),
        sender: player,
        zoneId: this.#zoneId,
        content: sent.payload.content,
        createdAt: new Date().toISOString(),
      };
      this.#emit({ type: "world:message", zoneId: this.#zoneId, message });
    }
    close() {
      this.readyState = 3;
    }
    #emit(body: unknown) {
      this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(body) }));
    }
  }
  const LabWebSocket = function (url: string | URL, protocols?: string | string[]) {
    const path = new URL(String(url)).pathname;
    if (path === "/api/chat/inbox") return new LabInbox();
    const room = path.match(/^\/api\/chat\/rooms\/(.+)$/);
    return room ? new LabRoom(decodeURIComponent(room[1]!)) : new Network(url, protocols);
  };
  // Its states, as the transport reads them (WebSocket.OPEN): without them nothing it sends would leave.
  window.WebSocket = Object.assign(LabWebSocket, {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  }) as unknown as typeof WebSocket;
  return () => {
    window.WebSocket = Network;
    window.fetch = previousFetch;
  };
};
