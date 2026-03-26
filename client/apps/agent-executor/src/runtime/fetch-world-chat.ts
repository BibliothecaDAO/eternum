export interface WorldChatEntry {
  senderId: string;
  senderDisplayName?: string;
  content: string;
  createdAt: string;
}

export async function fetchRecentWorldChat(input: {
  realtimeServerUrl: string;
  zoneId: string;
  agentId: string;
  limit?: number;
}): Promise<WorldChatEntry[]> {
  try {
    const url = new URL("/api/chat/world", input.realtimeServerUrl);
    url.searchParams.set("zoneId", input.zoneId);
    url.searchParams.set("limit", String(input.limit ?? 10));

    const resp = await fetch(url.toString(), {
      headers: { "x-player-id": `agent:${input.agentId}` },
    });
    if (!resp.ok) return [];

    const data = await resp.json();
    const messages: WorldChatEntry[] = (data.messages ?? [])
      .filter((m: any) => m.senderId !== `agent:${input.agentId}`)
      .map((m: any) => ({
        senderId: m.senderId,
        senderDisplayName: m.senderDisplayName ?? undefined,
        content: m.content,
        createdAt: m.createdAt,
      }));

    // API returns desc order, reverse to chronological
    return messages.reverse();
  } catch {
    return [];
  }
}
