type ToolExecutionEndEvent = {
  type: "tool_execution_end";
  toolName: string;
  isError: boolean;
  result?: {
    details?: Record<string, unknown>;
    content?: Array<{ type?: string; text?: string }>;
  };
};

export interface ToolExecutionSummary {
  status: "ok" | "fail";
  success?: boolean;
  txHash?: string;
  reasonCode?: string;
  error?: string;
}

function parseResultObject(event: ToolExecutionEndEvent): Record<string, unknown> | undefined {
  const blocks = event.result?.content;
  if (!Array.isArray(blocks)) return undefined;
  for (const block of blocks) {
    if (block?.type !== "text" || typeof block.text !== "string") continue;
    try {
      const parsed = JSON.parse(block.text) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {}
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Map tool execution event data to user-facing action status.
 * Tool transport can succeed while on-chain action fails; use execute_action
 * result payload to derive accurate status.
 */
export function summarizeToolExecutionEnd(event: ToolExecutionEndEvent): ToolExecutionSummary {
  const details = event.result?.details ?? {};
  const parsed = parseResultObject(event);
  const detailSuccess = typeof details.success === "boolean" ? details.success : undefined;
  const parsedSuccess = typeof parsed?.success === "boolean" ? parsed.success : undefined;
  const success = detailSuccess ?? parsedSuccess;

  const isActionTool = event.toolName === "execute_action" || event.toolName === "simulate_action";
  const failed = event.isError || (isActionTool && success === false);

  return {
    status: failed ? "fail" : "ok",
    success,
    txHash: asString(parsed?.txHash),
    reasonCode: asString(parsed?.reasonCode),
    error: asString(parsed?.error),
  };
}
