/**
 * Detect @agent:<uuid> mentions in chat messages and wake the mentioned agents
 * via the agent gateway.
 */

/** Extract agent IDs from @agent:<uuid> patterns in chat content. */
export function extractAgentMentions(content: string): string[] {
  const pattern = /@agent:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi;
  const ids: string[] = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    ids.push(match[1].toLowerCase());
  }
  return [...new Set(ids)];
}

/** Wake an agent via the gateway when mentioned in world chat. */
export async function wakeAgentOnMention(
  agentId: string,
  message: {
    id: string;
    senderId: string;
    senderDisplayName: string | null;
    content: string;
  },
  zoneId: string,
): Promise<void> {
  const gatewayUrl = process.env.AGENT_GATEWAY_URL;
  if (!gatewayUrl) return;

  const sender = message.senderDisplayName ?? message.senderId;
  await fetch(`${gatewayUrl}/agents/${agentId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: `[Chat mention in zone "${zoneId}"] ${sender}: ${message.content}`,
      metadata: {
        source: "world_chat_mention",
        zoneId,
        messageId: message.id,
        senderId: message.senderId,
      },
    }),
  });
}
