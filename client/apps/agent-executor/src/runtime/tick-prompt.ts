import type { WorldChatEntry } from "./fetch-world-chat";

export type ToolError = {
  tool: string;
  error: string;
};

export function buildTickPrompt(
  briefing: Record<string, unknown> | null | undefined,
  toolErrors: ToolError[],
  memory: string,
  chatMessages?: WorldChatEntry[],
): string {
  if (!briefing) {
    return "Map not yet loaded. Wait for next tick.";
  }

  const parts = ["## Tick", "", JSON.stringify(briefing, null, 2)];
  if (memory) {
    parts.push("", "## Memory", memory);
  }
  if (toolErrors.length > 0) {
    parts.push("", "## Recent Errors", ...toolErrors.map((error) => `- ${error.tool}: ${error.error}`));
  }
  if (chatMessages && chatMessages.length > 0) {
    parts.push("", "## World Chat (recent)");
    for (const msg of chatMessages) {
      const sender = msg.senderDisplayName || msg.senderId;
      const time = msg.createdAt ? new Date(msg.createdAt).toISOString().slice(11, 19) : "?";
      parts.push(`- [${time}] ${sender}: ${msg.content}`);
    }
  }
  parts.push(
    "",
    "## Constraints",
    "- Stamina regenerates over time (20/tick). Travel costs vary by biome.",
    "- Attacking with low stamina deals no damage.",
    "- Many actions require adjacency.",
    "- Move adjacent before combat, raids, transfers, or chest interaction.",
    "- Simulate before committing when combat is uncertain.",
    "",
    "Act on threats first, then opportunities. If there is a beneficial legal move available now, take it.",
  );
  return parts.join("\n");
}
