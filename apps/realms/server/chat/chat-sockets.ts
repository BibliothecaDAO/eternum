/** Who is on a chat socket: the Realms account the Worker authenticated, and the name it shows. */
export interface ChatMember {
  realmsId: string;
  displayName?: string;
  /** The socket's message budget, kept on the socket so it survives the object's hibernation. */
  tokens?: number;
  refilledAt?: number;
}

const MAX_FRAME_BYTES = 8 * 1024;
const BURST = 10;
const PER_SECOND = 5;

/** The Worker admits a socket and names its member in headers; the object never sees a cookie. */
export const chatMemberHeaders = (member: { realmsId: string; displayName?: string | null }) => ({
  "x-realms-id": member.realmsId,
  ...(member.displayName ? { "x-display-name": encodeURIComponent(member.displayName) } : {}),
});

export const chatMemberOf = (request: Request): ChatMember | null => {
  const realmsId = request.headers.get("x-realms-id");
  if (!realmsId) return null;
  const displayName = request.headers.get("x-display-name");
  return { realmsId, ...(displayName ? { displayName: decodeURIComponent(displayName) } : {}) };
};

export const sendChat = (socket: WebSocket, payload: unknown) => {
  try {
    socket.send(JSON.stringify(payload));
  } catch (error) {
    console.error("chat_delivery_failed", error);
  }
};

/** One client frame: a bounded JSON object with a type, or null after telling the client why not. */
export const readChatFrame = (socket: WebSocket, data: string | ArrayBuffer): { type: string } | null => {
  const text = typeof data === "string" ? data : new TextDecoder().decode(data);
  if (new TextEncoder().encode(text).byteLength > MAX_FRAME_BYTES) {
    sendChat(socket, { type: "error", code: "message_too_large", message: "Chat message exceeds the size limit." });
    return null;
  }
  try {
    const frame = JSON.parse(text) as unknown;
    if (frame && typeof frame === "object" && typeof (frame as { type?: unknown }).type === "string")
      return frame as { type: string };
  } catch {
    // Reported below.
  }
  sendChat(socket, { type: "error", code: "invalid_message", message: "Malformed chat message." });
  return null;
};

/** A token bucket per socket: a burst of ten, then five messages a second. */
export const consumeChatBudget = (socket: WebSocket): boolean => {
  const member = socket.deserializeAttachment() as ChatMember;
  const now = Date.now();
  const refilled = Math.min(BURST, (member.tokens ?? BURST) + ((now - (member.refilledAt ?? now)) / 1000) * PER_SECOND);
  if (refilled < 1) {
    sendChat(socket, { type: "error", code: "rate_limited", message: "Chat message rate exceeded." });
    return false;
  }
  socket.serializeAttachment({ ...member, tokens: refilled - 1, refilledAt: now });
  return true;
};
