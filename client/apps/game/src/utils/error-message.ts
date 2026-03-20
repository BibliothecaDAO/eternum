const NON_MEANINGFUL_ERROR_MESSAGES = new Set(["", "[object Object]", "undefined", "null"]);
const GENERIC_ERROR_MESSAGES = new Set([
  "transaction execution error",
  "execution error",
  "rpc error",
  "unknown error",
  "unknown revert reason",
  "transaction failed",
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

  const normalized = normalizeErrorKey(reason);
  if (GENERIC_ERROR_MESSAGES.has(normalized) || isWrappedGenericErrorMessage(reason) || isProtocolErrorCode(reason)) {
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

export const extractReadableErrorMessage = (error: unknown, fallback = "Unknown error"): string => {
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
      if (visited.has(current)) continue;
      visited.add(current);
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
    // Ignore serialization failures and use fallback
  }

  return fallback;
};
