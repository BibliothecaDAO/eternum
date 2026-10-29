import { GLOBAL_CHAT_CHANNEL_ID, isLobbyRoom } from "@bibliothecadao/types";

import { LAB_SESSION } from "./app-lab-fixtures";

/**
 * Chat's sockets, answered in the tab, as the chat Worker answers them. The inbox greets the lab's player with the rooms
 * they may join: the world's and `gameRooms`. A room admits them to the zone its address names, with whether they write
 * (a Blitz lobby's room when `lobbyWrites`, as it answers a player registered in its slot; any other room always), and
 * echoes what they send as the room would broadcast it. Any other socket opens as before.
 */
export const answerLabChat = ({
  lobbyWrites = false,
  gameRooms = [],
}: {
  lobbyWrites?: boolean;
  gameRooms?: readonly string[];
}) => {
  const Network = window.WebSocket;
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
      const sent = JSON.parse(data) as { payload: { content: string }; clientMessageId?: string };
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
  window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
    const path = new URL(String(url)).pathname;
    if (path === "/api/chat/inbox") return new LabInbox();
    const room = path.match(/^\/api\/chat\/rooms\/(.+)$/);
    return room ? new LabRoom(decodeURIComponent(room[1]!)) : new Network(url, protocols);
  } as unknown as typeof WebSocket;
};
