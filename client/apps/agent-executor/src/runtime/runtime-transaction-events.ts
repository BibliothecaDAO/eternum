import type { ManagedAgentRuntime } from "@bibliothecadao/agent-runtime";

type ProviderEventEmitter = {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
};

type ToolExecutionContext = {
  runtimeToolCallId: string;
  toolName?: string;
};

export function attachRuntimeTransactionObserver(input: {
  provider: ProviderEventEmitter;
  runtime: ManagedAgentRuntime;
}): () => void {
  let toolSequence = 0;
  let activeTool: ToolExecutionContext | null = null;
  const toolContextByTransactionHash = new Map<string, ToolExecutionContext>();

  const unsubscribeRuntime = input.runtime.onEvent((event) => {
    if (event.type === "tool_execution_start") {
      activeTool = {
        runtimeToolCallId: resolveRuntimeToolCallId(event.payload, ++toolSequence),
        toolName: asOptionalString(event.payload?.toolName),
      };
      return;
    }

    if (event.type === "tool_execution_end") {
      activeTool = null;
    }
  });

  const handleTransactionSubmitted = (payload: Record<string, unknown>) => {
    const txHash = asOptionalString(payload.transactionHash);
    const toolContext = resolveToolContext(activeTool, txHash, toolContextByTransactionHash);
    const primaryAction = resolvePrimaryActionSummary(payload);

    input.runtime.emit({
      type: "managed_runtime.transaction_submitted",
      payload: {
        runtimeToolCallId: toolContext?.runtimeToolCallId,
        toolName: toolContext?.toolName,
        contractAddress: primaryAction?.contractAddress,
        entrypoint: primaryAction?.entrypoint,
        calldataSummary: primaryAction?.calldataSummary,
        txHash,
        receiptStatus: "PENDING",
      },
    });
  };

  const handleTransactionComplete = (payload: Record<string, unknown>) => {
    const txHash = asOptionalString(payload.transactionHash);
    const toolContext = resolveToolContext(null, txHash, toolContextByTransactionHash);
    const primaryAction = resolvePrimaryActionSummary(payload);
    const receiptStatus = resolveReceiptStatus(payload.details);

    input.runtime.emit({
      type: "managed_runtime.transaction_confirmed",
      payload: {
        runtimeToolCallId: toolContext?.runtimeToolCallId,
        toolName: toolContext?.toolName,
        contractAddress: primaryAction?.contractAddress,
        entrypoint: primaryAction?.entrypoint,
        calldataSummary: primaryAction?.calldataSummary,
        txHash,
        receiptStatus,
        isError: receiptStatus === "REVERTED",
      },
    });

    if (txHash) {
      toolContextByTransactionHash.delete(txHash);
    }
  };

  const handleTransactionFailed = (message: string, payload?: Record<string, unknown>) => {
    const txHash = asOptionalString(payload?.transactionHash);
    const toolContext = resolveToolContext(activeTool, txHash, toolContextByTransactionHash);
    const primaryAction = resolvePrimaryActionSummary(payload);

    input.runtime.emit({
      type: "managed_runtime.transaction_confirmed",
      payload: {
        runtimeToolCallId: toolContext?.runtimeToolCallId,
        toolName: toolContext?.toolName,
        contractAddress: primaryAction?.contractAddress,
        entrypoint: primaryAction?.entrypoint,
        calldataSummary: primaryAction?.calldataSummary,
        txHash,
        receiptStatus: "REVERTED",
        isError: true,
        errorMessage: message,
      },
    });

    if (txHash) {
      toolContextByTransactionHash.delete(txHash);
    }
  };

  input.provider.on("transactionSubmitted", handleTransactionSubmitted);
  input.provider.on("transactionComplete", handleTransactionComplete);
  input.provider.on("transactionFailed", handleTransactionFailed);

  return () => {
    unsubscribeRuntime();
    input.provider.off("transactionSubmitted", handleTransactionSubmitted);
    input.provider.off("transactionComplete", handleTransactionComplete);
    input.provider.off("transactionFailed", handleTransactionFailed);
  };
}

function resolveRuntimeToolCallId(payload: Record<string, unknown> | undefined, sequence: number): string {
  return asOptionalString(payload?.toolCallId) ?? `tool-${sequence}`;
}

function resolveToolContext(
  activeTool: ToolExecutionContext | null,
  txHash: string | undefined,
  toolContextByTransactionHash: Map<string, ToolExecutionContext>,
): ToolExecutionContext | null {
  if (txHash && activeTool) {
    toolContextByTransactionHash.set(txHash, activeTool);
    return activeTool;
  }

  if (txHash) {
    return toolContextByTransactionHash.get(txHash) ?? null;
  }

  return activeTool;
}

function resolvePrimaryActionSummary(payload: Record<string, unknown> | undefined) {
  const actionSummaries = Array.isArray(payload?.actionSummaries)
    ? (payload.actionSummaries as Array<Record<string, unknown>>)
    : [];

  return actionSummaries[0]
    ? {
        contractAddress: asOptionalString(actionSummaries[0].contractAddress),
        entrypoint: asOptionalString(actionSummaries[0].entrypoint),
        calldataSummary: asOptionalString(actionSummaries[0].calldataSummary),
      }
    : null;
}

function resolveReceiptStatus(details: unknown): string {
  if (details && typeof details === "object") {
    const receipt = details as Record<string, unknown>;
    const executionStatus = asOptionalString(receipt.execution_status);
    if (executionStatus) {
      return executionStatus;
    }

    const finalityStatus = asOptionalString(receipt.finality_status);
    if (finalityStatus) {
      return finalityStatus;
    }
  }

  return "SUCCEEDED";
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
