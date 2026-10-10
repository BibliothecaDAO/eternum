import type { WorldChatMessage } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { fetchApi } from "@/runtime/app-api";

/**
 * A Blitz lobby's chat: the room `slot:<name>` on the identity Worker's chat, opened by the lobby itself. Any signed-in
 * player reads it. Nobody writes from a slot's lobby until it is ruled who may (a paid registrant is not seated yet).
 */
const HISTORY = 50;

/** Why the lobby's chat cannot be read now; the panel says it in its own words. */
type ChatHold = "signed-out" | "unanswered";

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

type RoomMessage = { type: string; message?: WorldChatMessage };

/** A frame that is not JSON is no message; the room says nothing by it. */
const parsed = (data: unknown): RoomMessage | null => {
  try {
    return JSON.parse(String(data)) as RoomMessage;
  } catch {
    return null;
  }
};

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

  useEffect(() => {
    if (!signedIn) return;
    const room = new WebSocket(roomUrl(zoneId));
    room.addEventListener("message", (event) => {
      const message = parsed(event.data);
      if (!message) return;
      if (message.type === "world:message" && message.message) {
        const arrived = message.message;
        setLive((current) => [...current, arrived]);
        setHold(null);
      }
    });
    room.addEventListener("close", () => setHold((current) => current ?? "unanswered"));
    return () => room.close();
  }, [signedIn, zoneId]);

  return {
    messages: merged(history.data ?? [], live),
    hold: !signedIn ? ("signed-out" as const) : history.isError ? ("unanswered" as const) : hold,
  };
};
