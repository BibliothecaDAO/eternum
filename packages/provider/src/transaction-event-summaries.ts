import type { AllowArray, Call } from "starknet";

export interface TransactionCallSummary {
  contractAddress: string;
  entrypoint: string;
  calldataSummary: string;
}

const ENTRYPOINT_SUMMARIZERS: Record<string, (calldata: unknown[]) => string> = {
  explorer_extract_reward: ([explorerId]) => `explorer_id=${formatValue(explorerId)}`,
  explorer_move: ([explorerId, directions, explore]) =>
    `explorer_id=${formatValue(explorerId)}, directions=${formatValue(directions)}, explore=${formatValue(explore)}`,
};

export function summarizeTransactionCalls(calls: AllowArray<Call>): TransactionCallSummary[] {
  return normalizeCalls(calls).map((call) => ({
    contractAddress: call.contractAddress,
    entrypoint: call.entrypoint,
    calldataSummary: summarizeCallCalldata(call.entrypoint, normalizeCalldata(call.calldata)),
  }));
}

function normalizeCalls(calls: AllowArray<Call>): Call[] {
  return Array.isArray(calls) ? calls : [calls];
}

function normalizeCalldata(calldata: unknown): unknown[] {
  if (Array.isArray(calldata)) {
    return calldata;
  }

  return [calldata];
}

function summarizeCallCalldata(entrypoint: string, calldata: unknown[]): string {
  const summarizeKnownEntrypoint = ENTRYPOINT_SUMMARIZERS[entrypoint];
  if (summarizeKnownEntrypoint) {
    return summarizeKnownEntrypoint(calldata);
  }

  return calldata.map((value, index) => `arg${index}=${formatValue(value)}`).join(", ");
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatValue(item)).join(",")}]`;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
