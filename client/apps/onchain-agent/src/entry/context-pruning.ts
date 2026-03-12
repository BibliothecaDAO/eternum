import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Message, Model } from "@mariozechner/pi-ai";
import { completeSimple } from "@mariozechner/pi-ai";

function estimateChars(messages: AgentMessage[]): number {
  let total = 0;
  for (const m of messages) {
    const msg = m as Message;
    if (typeof msg.content === "string") {
      total += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if ("text" in block) total += block.text.length;
      }
    }
  }
  return total;
}

function splitMessages(
  messages: AgentMessage[],
  target: number = 200_000,
): { dropped: AgentMessage[]; kept: AgentMessage[] } {
  let kept = 0;
  let cutIndex = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as Message;
    let chars = 0;
    if (typeof msg.content === "string") {
      chars = msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if ("text" in block) chars += block.text.length;
      }
    }
    kept += chars;
    if (kept > target) {
      cutIndex = i + 1;
      break;
    }
  }

  if (cutIndex >= messages.length) cutIndex = messages.length - 1;
  return {
    dropped: messages.slice(0, cutIndex),
    kept: messages.slice(cutIndex),
  };
}

export async function pruneMessages(
  messages: AgentMessage[],
  model: Model<any>,
  maxChars: number = 400_000,
  pruneTarget: number = 200_000,
): Promise<AgentMessage[]> {
  if (estimateChars(messages) <= maxChars) return messages;

  const { dropped, kept } = splitMessages(messages, pruneTarget);
  if (dropped.length === 0) return kept;

  const droppedLlm = dropped.filter(
    (m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult",
  );

  let summary = `[Context compacted: ${dropped.length} older messages dropped.]`;
  try {
    const result = await completeSimple(model, {
      systemPrompt:
        "Summarize this conversation history in 2-3 paragraphs. Focus on: strategic decisions made, " +
        "current military positions, resource state, ongoing plans, and any threats identified. " +
        "Be specific about coordinates, entity names, and outcomes.",
      messages: [
        {
          role: "user" as const,
          content: droppedLlm
            .map((m) => {
              const text =
                typeof m.content === "string"
                  ? m.content
                  : Array.isArray(m.content)
                    ? m.content
                        .filter((b): b is { type: "text"; text: string } => "text" in b)
                        .map((b) => b.text)
                        .join("\n")
                    : "";
              return `[${m.role}]: ${text}`;
            })
            .join("\n\n"),
          timestamp: Date.now(),
        },
      ],
    });

    const text = result.content.find((b): b is { type: "text"; text: string } => b.type === "text");
    if (text) {
      summary = `[Context compacted: ${dropped.length} older messages summarized]\n\n${text.text}`;
    }
  } catch (err) {
    console.error("Compaction summary failed, using fallback:", err instanceof Error ? err.message : err);
    summary += " Use inspect and the map to re-orient.";
  }

  kept.unshift({
    role: "user" as const,
    content: summary,
    timestamp: Date.now(),
  } as AgentMessage);

  return kept;
}
