import type { WorldChatMessage } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { fetchApi } from "@/runtime/app-api";

/**
 * A Blitz lobby's chat: the room `slot:<name>` on the identity Worker's chat, opened by the lobby itself. Any signed-in
 * player reads it; a player whose payout wallet is registered in the slot writes, which the Worker decides when the
 * room opens and says in its join answer.
 */
const HISTORY = 50;

/** Why the lobby's chat cannot be read, or a message was not taken; the panel says it in its own words. */
export type ChatHold = "signed-out" | "unanswered" | "rate-limited" | "refused";

const roomOf = (slotName: string) => `slot:${slotName}`;

/** The room's socket address: the app's own origin, its chat rooms path (apps/realms/server/chat/routes.ts). */
const roomUrl = (zoneId: string) => {
  const url = new URL(`/api/chat/rooms/${encodeURIComponent(zoneId)}`, window.location.origin);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  return url.toString();
};

const fetchHistory = async (zoneId: string): Promise<WorldChatMessage[]> => {
  const response = await fetchApi(`/api/chat/world?zoneId=${encodeURIComponent(zoneId)}&limit=${HISTORY}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Chat answered ${response.status}`);
  const body = (await response.json()) as { messages?: WorldChatMessage[] };
  return body.messages ?? [];
};

/** Oldest first, each message once (the history and the socket may both carry one). */
const merged = (history: readonly WorldChatMessage[], live: readonly WorldChatMessage[]) => {
  const byId = new Map([...history, ...live].map((message) => [message.id, message]));
  return [...byId.values()].toSorted((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

type RoomMessage = { type: string; message?: WorldChatMessage; code?: string; canWrite?: boolean };

/** A frame that is not JSON is no message; the room says nothing by it. */
const parsed = (data: unknown): RoomMessage | null => {
  try {
    return JSON.parse(String(data)) as RoomMessage;
  } catch {
    return null;
  }
};

/**
 * The lobby's chat. `membership` names what the room's write decision was taken on (the payout wallet and its
 * registration in the slot): the room is opened again when it changes, because the server decides once, at the open.
 */
export const useLobbyChat = (slotName: string, membership: string) => {
  const { session } = useIdentitySession();
  const zoneId = roomOf(slotName);
  const signedIn = session !== null;
  const history = useQuery({
    queryKey: ["shell", "lobby-chat", zoneId],
    queryFn: () => fetchHistory(zoneId),
    enabled: signedIn,
    staleTime: Infinity,
    retry: 1,
  });
  const [live, setLive] = useState<WorldChatMessage[]>([]);
  const [hold, setHold] = useState<ChatHold | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    const room = new WebSocket(roomUrl(zoneId));
    socket.current = room;
    let replaced = false;
    room.addEventListener("message", (event) => {
      const message = parsed(event.data);
      if (!message) return;
      if (message.type === "joined:zone") setCanWrite(message.canWrite === true);
      if (message.type === "world:message" && message.message) {
        const arrived = message.message;
        setLive((current) => [...current, arrived]);
        setHold(null);
      }
      // The room's decision outlived the registration it was taken on: the field goes until the room is opened again.
      if (message.type === "error" && message.code === "registration_required") setCanWrite(false);
      else if (message.type === "error") setHold(message.code === "rate_limited" ? "rate-limited" : "refused");
    });
    room.addEventListener("close", () => {
      if (!replaced) setHold((current) => current ?? "unanswered");
    });
    return () => {
      replaced = true;
      socket.current = null;
      setCanWrite(false);
      room.close();
    };
  }, [signedIn, zoneId, membership]);

  const send = useCallback(
    (content: string) =>
      socket.current?.send(
        JSON.stringify({
          type: "world:publish",
          zoneId,
          payload: { zoneId, content },
          clientMessageId: crypto.randomUUID(),
        }),
      ),
    [zoneId],
  );

  return {
    messages: merged(history.data ?? [], live),
    hold: !signedIn ? ("signed-out" as const) : history.isError ? ("unanswered" as const) : hold,
    /** Whether the room lets this reader write: the server's answer at the open, never the client's own guess. */
    canWrite,
    send,
  };
};
