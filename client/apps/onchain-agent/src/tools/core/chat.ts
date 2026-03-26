import { publishAgentWorldChat } from "@bibliothecadao/agent-runtime";
import type { ToolContext } from "./context.js";

export interface SendWorldChatInput {
  content: string;
  zoneId?: string;
}

export interface SendWorldChatResult {
  success: boolean;
  message: string;
}

export async function sendWorldChat(
  input: SendWorldChatInput,
  ctx: ToolContext,
): Promise<SendWorldChatResult> {
  if (!ctx.realtimeServerUrl) {
    return { success: false, message: "Chat not available: realtime server URL not configured." };
  }
  if (!ctx.agentId) {
    return { success: false, message: "Chat not available: agent ID not configured." };
  }

  const zoneId = input.zoneId ?? "global";
  try {
    await publishAgentWorldChat({
      baseUrl: ctx.realtimeServerUrl,
      zoneId,
      content: input.content,
      agentId: ctx.agentId,
      kind: ctx.agentKind ?? "player",
    });
    return { success: true, message: `Message sent to zone "${zoneId}".` };
  } catch (err: any) {
    return { success: false, message: `Failed to send chat: ${err.message ?? String(err)}` };
  }
}
