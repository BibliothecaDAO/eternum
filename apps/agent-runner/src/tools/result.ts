import type { AgentToolResult } from "@mariozechner/pi-agent-core";

/** Every tool answers the model in text; `details` carries the structured shape for logs and the run manifest. */
export const textResult = <T>(text: string, details: T): AgentToolResult<T> => ({
  content: [{ type: "text", text }],
  details,
});

/** Lists stay readable for the model: the first `limit` entries, then a count of what was left out. */
export const clipList = (lines: string[], limit: number): string[] =>
  lines.length <= limit ? lines : [...lines.slice(0, limit), `… and ${lines.length - limit} more`];

export const clipText = (text: string, maxLength: number): string =>
  text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
