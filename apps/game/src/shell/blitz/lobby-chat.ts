import type { WorldChatMessage } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { fetchApi } from "@/runtime/app-api";

/**
 * A Blitz lobby's chat (lobby-chat-mmr.txt): the room `slot:<name>` on the identity Worker's chat, opened by the lobby
 * itself. Any signed-in player reads it; only a seated player writes, and the Worker checks the seat on every message.
 */
const HISTORY = 50;

/** Why the lobby's chat cannot be read or written now; the panel says it in its own words. */
export type ChatHold = "signed-out" | "unanswered" | "seat-required" | "rate-limited" | "refused";

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

type RoomMessage = { type: string; message?: WorldChatMessage; code?: string };

/** A frame that is not JSON is no message; the room says nothing by it. */
const parsed = (data: unknown): RoomMessage | null => {
  try {
    return JSON.parse(String(data)) as RoomMessage;
  } catch {
    return null;
  }
};

const holdOfCode = (code: unknown): ChatHold =>
  code === "seat_required" ? "seat-required" : code === "rate_limited" ? "rate-limited" : "refused";

export const useLobbyChat = (slotName: string) => {
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
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    const room = new WebSocket(roomUrl(zoneId));
    socket.current = room;
    room.addEventListener("message", (event) => {
      const message = parsed(event.data);
      if (!message) return;
      if (message.type === "world:message" && message.message) {
        const arrived = message.message;
        setLive((current) => [...current, arrived]);
        setHold(null);
      }
      if (message.type === "error") setHold(holdOfCode(message.code));
    });
    room.addEventListener("close", () => setHold((current) => current ?? "unanswered"));
    return () => {
      socket.current = null;
      room.close();
    };
  }, [signedIn, zoneId]);

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
    send,
  };
};
