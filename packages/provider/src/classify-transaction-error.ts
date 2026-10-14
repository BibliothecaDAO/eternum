import * as Data from "effect/Data";

/**
 * Single home for making sense of unknown transaction errors.
 *
 * Two exports:
 * - `extractErrorMessage` digs a human-readable panic/revert reason out of any
 *   error shape (Error, string, plain object, nested Cairo traces).
 * - `classifyTransactionError` maps any error to a small decision kind the UI
 *   can act on (wallet rejection, revert, submit failure, or unknown).
 */

const NON_MEANINGFUL_ERROR_MESSAGES = new Set(["", "[object Object]", "undefined", "null"]);
const GENERIC_ERROR_MESSAGES = new Set([
  "transaction execution error",
  "execution error",
  "rpc error",
  "unknown error",
  "unknown revert reason",
  "transaction failed",
  // The bare word the /revert…/ pattern captures out of "Unknown revert reason";
  // never a real panic message.
  "reason",
]);
const GENERIC_ERROR_PREFIXES = ["transaction execution error:", "rpc error:", "rpc:"];
const WRAPPED_ERROR_PREFIXES = [
  "Transaction failed to submit:",
  "Transaction failed while waiting for confirmation:",
  "Transaction failed with reason:",
];

const normalizeErrorKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.:]+$/g, "");

const isProtocolErrorCode = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^0x[0-9a-f]+$/i.test(trimmed)) return true;
  if (/^[A-Z0-9_]{3,}$/.test(trimmed)) return true;
  if (/^[a-z0-9_-]+\/[a-z0-9_-]+$/i.test(trimmed)) return true;
  return false;
};

const isWrappedGenericErrorMessage = (message: string): boolean => {
  const normalizedMessage = normalizeErrorKey(message);
  for (const wrappedPrefix of WRAPPED_ERROR_PREFIXES) {
    const normalizedPrefix = wrappedPrefix.toLowerCase();
    if (!normalizedMessage.startsWith(normalizedPrefix)) continue;
    const rawSuffix = message.trim().slice(wrappedPrefix.length).trim();
    const normalizedSuffix = normalizeErrorKey(rawSuffix);
    return !rawSuffix || GENERIC_ERROR_MESSAGES.has(normalizedSuffix) || isProtocolErrorCode(rawSuffix);
  }

  return false;
};

const sanitizeReason = (value: string): string | null => {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed || NON_MEANINGFUL_ERROR_MESSAGES.has(trimmed)) {
    return null;
  }

  return trimmed;
};

const asReasonCandidate = (value: string): string | null => {
  const reason = sanitizeReason(value);
  if (!reason) {
    return null;
  }

  if (isGenericErrorMessage(reason)) {
    return null;
  }

  if (reason.includes("/")) return null;
  if (/^[A-Z0-9_/-]+$/.test(reason)) return null;
  if (/^0x[0-9a-f]+$/i.test(reason)) return null;
  if (!/[a-zA-Z]/.test(reason)) return null;

  return reason;
};

const decodeHexToAscii = (value: string): string | null => {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (normalized.length < 4 || normalized.length % 2 !== 0) {
    return null;
  }

  let decoded = "";
  for (let i = 0; i < normalized.length; i += 2) {
    const byte = Number.parseInt(normalized.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      return null;
    }
    decoded += String.fromCharCode(byte);
  }

  const cleaned = decoded.replace(/\0/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const printableCount = [...cleaned].filter((char) => {
    const code = char.charCodeAt(0);
    return (code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13;
  }).length;

  return printableCount / cleaned.length >= 0.85 ? cleaned : null;
};

const extractSpecificReasonFromMessage = (message: string): string | null => {
  // RPC failure shape: "Execution failed. Failure reason: 0x… ('panic text')."
  // Nested calls repeat the header, and the LAST frame is the innermost assert —
  // the message the contract actually panicked with.
  const failureReasonFrames = [...message.matchAll(/Failure reason:\s*0x[0-9a-f]+\s*\('([^']+)'\)/gi)];
  const innermostFailureReason = failureReasonFrames[failureReasonFrames.length - 1]?.[1];
  if (innermostFailureReason) {
    const reason = asReasonCandidate(innermostFailureReason);
    if (reason) {
      return reason;
    }
  }

  const explicitReasonPatterns = [
    /,\s*\\"([^"\\]+)\\"\s*,\s*0x[0-9a-f]+ \('ENTRYPOINT_FAILED'\)/i,
    /,\s*0x[0-9a-f]+ \('([^']+)'\)\s*,\s*0x[0-9a-f]+ \('ENTRYPOINT_FAILED'\)/i,
    /Transaction failed with reason:\s*([^\n]+)/i,
    /execution reverted(?: with reason)?[:\s]+["']?([^"\n']+)["']?/i,
    /revert(?:ed)?(?: with reason)?[:\s]+["']?([^"\n']+)["']?/i,
  ];
  for (const pattern of explicitReasonPatterns) {
    const match = message.match(pattern);
    if (!match?.[1]) continue;
    const reason = asReasonCandidate(match[1]);
    if (reason) {
      return reason;
    }
  }

  for (const match of message.matchAll(/"([^"]+)"/g)) {
    const candidate = match[1]?.trim();
    if (!candidate) continue;
    const matchIndex = match.index ?? 0;
    const charAfterQuote = message.slice(matchIndex + match[0].length).trimStart();
    if (charAfterQuote.startsWith(":")) continue;
    const reason = asReasonCandidate(candidate);
    if (reason) {
      return reason;
    }
  }

  for (const match of message.matchAll(/'([^']+)'/g)) {
    const candidate = match[1]?.trim();
    if (!candidate) continue;
    const matchIndex = match.index ?? 0;
    const charAfterQuote = message.slice(matchIndex + match[0].length).trimStart();
    if (charAfterQuote.startsWith(":")) continue;
    const reason = asReasonCandidate(candidate);
    if (reason) {
      return reason;
    }
  }

  for (const match of message.matchAll(/0x[0-9a-f]{8,}/gi)) {
    const decoded = decodeHexToAscii(match[0]);
    if (!decoded) continue;
    const reason = asReasonCandidate(decoded);
    if (reason) {
      return reason;
    }
  }

  return null;
};

const isGenericErrorMessage = (message: string): boolean => {
  const normalized = normalizeErrorKey(message);
  if (
    GENERIC_ERROR_MESSAGES.has(normalized) ||
    GENERIC_ERROR_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
    isProtocolErrorCode(message)
  ) {
    return true;
  }

  return isWrappedGenericErrorMessage(message);
};

const asMeaningfulErrorMessage = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (NON_MEANINGFUL_ERROR_MESSAGES.has(trimmed)) {
      return null;
    }

    for (const prefix of WRAPPED_ERROR_PREFIXES) {
      if (!trimmed.startsWith(prefix)) continue;
      const suffix = trimmed.slice(prefix.length).trim();
      if (NON_MEANINGFUL_ERROR_MESSAGES.has(suffix)) {
        return null;
      }
    }

    const specificReason = extractSpecificReasonFromMessage(trimmed);
    if (specificReason) {
      return specificReason;
    }

    return trimmed;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return null;
};

export const extractErrorMessage = (error: unknown, fallback = "Unknown error"): string => {
  const queue: unknown[] = [error];
  const visited = new Set<object>();

  const getSpecificMessage = (value: unknown): string | null => {
    const candidate = asMeaningfulErrorMessage(value);
    if (!candidate) {
      return null;
    }
    if (isGenericErrorMessage(candidate)) {
      return null;
    }
    return candidate;
  };

  while (queue.length > 0) {
    const current = queue.shift();
    if (current && typeof current === "object") {
      if (visited.has(current)) continue;
      visited.add(current);
    }
    const directMessage = getSpecificMessage(current);
    if (directMessage) {
      return directMessage;
    }

    if (current instanceof Error) {
      queue.push(current.message);
      queue.push((current as Error & { cause?: unknown }).cause);
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (current && typeof current === "object") {
      const record = current as Record<string, unknown>;

      const directCandidates = [
        record.shortMessage,
        record.reason,
        record.execution_error,
        record.executionError,
        record.revert_reason,
        record.revertReason,
        record.description,
        record.message,
      ];
      for (const candidate of directCandidates) {
        const directCandidateMessage = getSpecificMessage(candidate);
        if (directCandidateMessage) {
          return directCandidateMessage;
        }
      }

      queue.push(
        record.data,
        record.error,
        record.cause,
        record.details,
        record.execution_error,
        record.executionError,
        record.message,
        record.reason,
        record.revert_reason,
        record.revertReason,
        record.shortMessage,
        record.description,
      );
    }
  }

  try {
    if (error && typeof error === "object") {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}" && serialized !== "[]") {
        const serializedReason = extractSpecificReasonFromMessage(serialized);
        if (serializedReason && !isGenericErrorMessage(serializedReason)) {
          return serializedReason;
        }
      }
    }
  } catch {
    // Ignore serialization errors and use fallback
  }

  return fallback;
};

/** Formats an extracted error for a single physical console line. */
export const formatErrorForConsole = (error: unknown, fallback = "Unknown error"): string =>
  extractErrorMessage(error, fallback).replace(/\s+/g, " ").trim();

/** @public */
export type TransactionErrorKind =
  | "resource_bounds"
  | "user_cancelled"
  | "reverted"
  | "submit_failed"
  | "no_answer"
  | "interrupted"
  | "signer_unavailable"
  | "connection_destroyed"
  | "unknown";

/** @public */
export interface ClassifiedTransactionError {
  kind: TransactionErrorKind;
  reason?: string;
}

// Wallet adapters expose both structured codes and string-shaped cancellations.
const WALLET_REJECTION_PATTERNS = [
  /\b4001\b/,
  /action[_ ]?rejected/i,
  /cancelled by user/i,
  /denied by user/i,
  /rejected by user/i,
  /request aborted/i,
  /transaction rejected/i,
  /user (cancelled|canceled|closed|denied|rejected)/i,
  /wallet.*(cancelled|canceled|denied|rejected)/i,
];

const RESOURCE_BOUNDS_PATTERNS = [
  /out[- ]of[- ](?:gas|resources)/i,
  /resource[-_ ]bounds?/i,
  /(?:gas|resource)[-_ ]bounds?[-_ ](?:exceeded|overflow)/i,
  /insufficient max (?:amount|fee|gas)/i,
  /max fee/i,
  /fee too low/i,
  /insufficient fee/i,
];

const REVERT_MARKER_PATTERNS = [
  /execution reverted/i,
  /failed with reason/i,
  /\brevert(?:ed)?\b/i,
  /\bentrypoint_failed\b/i,
  /failure reason:/i,
];

const SUBMIT_FAILURE_PATTERNS = [/failed to submit/i, /submission timed out/i];

const asClassifiedReason = (error: unknown): string | undefined => {
  const reason = extractErrorMessage(error, "");
  return reason || undefined;
};

const inspectTransactionError = (error: unknown) => {
  const parts: string[] = [];
  const names = new Set<string>();
  const queue = [error];
  const seen = new Set<object>();
  while (queue.length) {
    const value = queue.shift();
    if (typeof value === "string" || typeof value === "number") {
      parts.push(String(value));
    } else if (value && typeof value === "object" && !seen.has(value)) {
      seen.add(value);
      const record = value as Record<string, unknown>;
      if (value instanceof Error) names.add(value.name);
      queue.push(
        ...(Array.isArray(value)
          ? value
          : [
              record.message,
              record.code,
              record.reason,
              record.data,
              record.error,
              record.cause,
              record.details,
              record.execution_error,
              record.executionError,
              record.revert_reason,
              record.revertReason,
              record.shortMessage,
            ]),
      );
    }
  }
  return { text: parts.join("\n"), names };
};

/** A provider boundary records the decision once; consumers use it without reparsing the wrapper. */
export class TransactionFailure extends Data.TaggedError("TransactionFailure")<{
  classification: ClassifiedTransactionError;
  message: string;
  cause: unknown;
}> {}

/**
 * Decide what a transaction failure means for the player.
 *
 * Lifecycle failures retain uncertainty. External provider messages are classified
 * here once; resource bounds take precedence over generic wallet/revert markers.
 */
export const classifyTransactionError = (error: unknown): ClassifiedTransactionError => {
  if (error instanceof TransactionFailure) return error.classification;
  const { text: searchableText, names } = inspectTransactionError(error);
  if (names.has("TransactionNoAnswerError")) return { kind: "no_answer", reason: asClassifiedReason(error) };
  if (names.has("AbortError") || searchableText.includes("Game client disposed"))
    return { kind: "interrupted", reason: asClassifiedReason(error) };
  if (/destroyed connection|connection destroyed/i.test(searchableText))
    return { kind: "connection_destroyed", reason: asClassifiedReason(error) };
  if (RESOURCE_BOUNDS_PATTERNS.some((pattern) => pattern.test(searchableText))) {
    return { kind: "resource_bounds", reason: asClassifiedReason(error) };
  }
  if (WALLET_REJECTION_PATTERNS.some((pattern) => pattern.test(searchableText))) {
    return { kind: "user_cancelled" };
  }
  if (/nonce|account validation failed|account balance|duplicate transaction/i.test(searchableText))
    return { kind: "signer_unavailable", reason: asClassifiedReason(error) };
  if (REVERT_MARKER_PATTERNS.some((pattern) => pattern.test(searchableText))) {
    return { kind: "reverted", reason: asClassifiedReason(error) };
  }
  if (SUBMIT_FAILURE_PATTERNS.some((pattern) => pattern.test(searchableText))) {
    return { kind: "submit_failed", reason: asClassifiedReason(error) };
  }

  return { kind: "unknown", reason: asClassifiedReason(error) };
};
