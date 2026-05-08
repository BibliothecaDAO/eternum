import * as Sentry from "@sentry/react";
import {
  type BatchedTransactionDetail,
  type TransactionFailureStage,
  type TransactionProviderState,
  type TransactionRetrySafety,
  type TransactionSubmitFailureKind,
  type TransactionType,
} from "@bibliothecadao/provider";
import { env } from "../../env";
import { getActiveWorld } from "@/runtime/world";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { resolveUserIdentity, resolveWalletIdentityMode } from "./wallet-identity";

export type ClientTransactionSurface =
  | "dojo_provider"
  | "registration"
  | "settlement"
  | "amm"
  | "prediction_market"
  | "factory"
  | "game_review"
  | "cosmetics"
  | "admin";

export type ClientTransactionFailureStage =
  | TransactionFailureStage
  | "wallet_rejected"
  | "validation"
  | "confirmation_unverified";

export interface ClientTransactionFailureContext {
  surface: ClientTransactionSurface;
  operation: string;
  stage: ClientTransactionFailureStage;
  transactionType?: TransactionType;
  transactionHash?: string;
  transactionCount?: number;
  batchDetails?: BatchedTransactionDetail[];
  entrypoints?: string[];
  contractAddresses?: string[];
  walletAddress?: string | null;
  chain?: string;
  worldName?: string;
  worldAddress?: string;
  rpcHost?: string;
  failureKind?: TransactionSubmitFailureKind;
  providerState?: TransactionProviderState;
  hasTxHash?: boolean;
  retrySafety?: TransactionRetrySafety;
}

type ClientTransactionBreadcrumbStage = "submitted" | "pending" | "completed" | ClientTransactionFailureStage;

const MAX_REPORTED_FAILURES = 200;
const DUPLICATE_TTL_MS = 5 * 60 * 1000;
const MAX_SANITIZE_DEPTH = 4;
const MAX_SANITIZE_KEYS = 20;
const MAX_SANITIZE_ITEMS = 20;
const MAX_STRING_LENGTH = 500;
const SENSITIVE_KEY_PATTERN = /account|calldata|private|secret|seed|signer|signature|password|authorization/i;
const WALLET_REJECTION_PATTERNS = [
  /4001/,
  /action[_ ]?rejected/i,
  /cancelled by user/i,
  /denied by user/i,
  /rejected by user/i,
  /request aborted/i,
  /transaction rejected/i,
  /user (cancelled|canceled|closed|denied|rejected)/i,
  /wallet.*(cancelled|canceled|denied|rejected)/i,
];
const REVERT_REASON_PATTERNS = [
  /execution reverted/i,
  /failed with reason/i,
  /\brevert(?:ed)?\b/i,
  /\bentrypoint_failed\b/i,
];
// Matches the "VrfProvider: not consumed" signature that fires when
// `request_random` and the subsequent `consume_random` disagree on source —
// typically a sign of stale-position salt drift or concurrent-account-explore
// race. Tagged separately so Phase E regressions are easy to flag in Sentry.
const VRF_NOT_CONSUMED_PATTERN = /vrf\s*provider[^a-z]*not\s*consumed/i;

const reportedFailureKeys = new Map<string, number>();

const readString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const isSentryTransactionMonitoringEnabled = (): boolean => {
  return import.meta.env.PROD && Boolean(env.VITE_PUBLIC_SENTRY_DSN) && env.VITE_PUBLIC_SENTRY_TX_FAILURES_ENABLED;
};

const shouldCaptureUserRejection = (): boolean => env.VITE_PUBLIC_SENTRY_TX_CAPTURE_USER_REJECTIONS;

const shouldSampleTransactionFailure = (): boolean => {
  const sampleRate = env.VITE_PUBLIC_SENTRY_TX_FAILURE_SAMPLE_RATE;
  return sampleRate >= 1 || Math.random() <= sampleRate;
};

const pruneReportedFailureKeys = (now: number) => {
  for (const [key, timestamp] of reportedFailureKeys) {
    if (now - timestamp > DUPLICATE_TTL_MS) {
      reportedFailureKeys.delete(key);
    }
  }

  while (reportedFailureKeys.size > MAX_REPORTED_FAILURES) {
    const oldestKey = reportedFailureKeys.keys().next().value;
    if (!oldestKey) break;
    reportedFailureKeys.delete(oldestKey);
  }
};

const shouldSkipDuplicateFailure = (key: string): boolean => {
  const now = Date.now();
  pruneReportedFailureKeys(now);
  const existingTimestamp = reportedFailureKeys.get(key);
  if (existingTimestamp && now - existingTimestamp <= DUPLICATE_TTL_MS) {
    return true;
  }

  reportedFailureKeys.set(key, now);
  return false;
};

const sanitizeString = (value: string): string => {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...`;
};

const sanitizeValue = (value: unknown, depth = 0): unknown => {
  if (value == null) {
    return value;
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return "[Truncated]";
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: readString(value.stack) ? sanitizeString(value.stack as string) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_SANITIZE_ITEMS).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const sanitizedRecord: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value).slice(0, MAX_SANITIZE_KEYS)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitizedRecord[key] = "[Filtered]";
        continue;
      }

      sanitizedRecord[key] = sanitizeValue(entryValue, depth + 1);
    }
    return sanitizedRecord;
  }

  return String(value);
};

const buildNormalizedReason = (error: unknown): string => {
  const readableMessage = extractReadableErrorMessage(error, "transaction failure");
  return readableMessage.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
};

const resolveDefaultContext = () => {
  const activeWorld = getActiveWorld();
  return {
    chain: activeWorld?.chain ?? env.VITE_PUBLIC_CHAIN,
    worldName: activeWorld?.name,
    worldAddress: activeWorld?.worldAddress,
  };
};

const buildFingerprint = ({
  surface,
  stage,
  transactionType,
  operation,
  normalizedReason,
  failureKind,
}: {
  surface: ClientTransactionSurface;
  stage: ClientTransactionFailureStage;
  transactionType?: TransactionType;
  operation: string;
  normalizedReason: string;
  failureKind?: TransactionSubmitFailureKind;
}) => {
  if (
    stage === "submit" &&
    (failureKind === "provider_connection_destroyed" || failureKind === "submission_timeout_no_hash")
  ) {
    return ["client-transaction-submission", failureKind, surface, transactionType ?? operation];
  }

  return ["client-transaction-failure", surface, stage, transactionType ?? operation, normalizedReason];
};

const buildDedupeKey = ({
  surface,
  operation,
  stage,
  transactionHash,
  normalizedReason,
}: {
  surface: ClientTransactionSurface;
  operation: string;
  stage: ClientTransactionFailureStage;
  transactionHash?: string;
  normalizedReason: string;
}) => {
  if (transactionHash) {
    return `${transactionHash}:${stage}`;
  }

  return `${surface}:${operation}:${stage}:${normalizedReason}`;
};

const buildBreadcrumbData = (context: Partial<Omit<ClientTransactionFailureContext, "stage">> & { stage?: string }) => {
  const defaultContext = resolveDefaultContext();
  return sanitizeValue({
    surface: context.surface,
    operation: context.operation,
    stage: context.stage,
    type: context.transactionType,
    transactionHash: context.transactionHash,
    transactionCount: context.transactionCount,
    batchDetails: context.batchDetails,
    entrypoints: context.entrypoints,
    contractAddresses: context.contractAddresses,
    chain: context.chain ?? defaultContext.chain,
    worldName: context.worldName ?? defaultContext.worldName,
    worldAddress: context.worldAddress ?? defaultContext.worldAddress,
    rpcHost: context.rpcHost,
    failureKind: context.failureKind,
    providerState: context.providerState,
    hasTxHash: context.hasTxHash,
    retrySafety: context.retrySafety,
  });
};

export const isWalletRejectedError = (error: unknown): boolean => {
  const readableMessage = extractReadableErrorMessage(error, "").trim();
  if (!readableMessage) {
    return false;
  }

  return WALLET_REJECTION_PATTERNS.some((pattern) => pattern.test(readableMessage));
};

export const isVrfNotConsumedError = (error: unknown): boolean => {
  const readableMessage = extractReadableErrorMessage(error, "").trim();
  if (!readableMessage) {
    return false;
  }
  return VRF_NOT_CONSUMED_PATTERN.test(readableMessage);
};

export const resolveClientTransactionFailureStageFromError = (
  error: unknown,
  fallback: Extract<ClientTransactionFailureStage, "submit" | "confirmation" | "background_confirmation">,
): ClientTransactionFailureStage => {
  if (isWalletRejectedError(error)) {
    return "wallet_rejected";
  }

  const readableMessage = extractReadableErrorMessage(error, "").trim();
  if (REVERT_REASON_PATTERNS.some((pattern) => pattern.test(readableMessage))) {
    return "revert";
  }

  return fallback;
};

export const addClientTransactionBreadcrumb = ({
  stage,
  message,
  context,
}: {
  stage: ClientTransactionBreadcrumbStage;
  message: string;
  context: Partial<ClientTransactionFailureContext>;
}) => {
  if (!isSentryTransactionMonitoringEnabled()) {
    return;
  }

  Sentry.addBreadcrumb({
    category: "transaction",
    type: "default",
    level: stage === "completed" || stage === "submitted" || stage === "pending" ? "info" : "error",
    message,
    data: buildBreadcrumbData({
      ...context,
      stage,
    }) as Record<string, unknown>,
  });
};

export const reportClientTransactionFailure = async ({
  error,
  context,
}: {
  error: unknown;
  context: ClientTransactionFailureContext;
}) => {
  const stage =
    context.stage === "confirmation" || context.stage === "background_confirmation" || context.stage === "submit"
      ? resolveClientTransactionFailureStageFromError(error, context.stage)
      : context.stage;
  const readableMessage = extractReadableErrorMessage(error, "Transaction failure");
  const failureContext: ClientTransactionFailureContext = {
    ...resolveDefaultContext(),
    ...context,
    stage,
  };

  addClientTransactionBreadcrumb({
    stage,
    message: readableMessage,
    context: failureContext,
  });

  if (!isSentryTransactionMonitoringEnabled()) {
    return;
  }

  if (stage === "wallet_rejected" && !shouldCaptureUserRejection()) {
    return;
  }

  if (!shouldSampleTransactionFailure()) {
    return;
  }

  const normalizedReason = buildNormalizedReason(error);
  const dedupeKey = buildDedupeKey({
    surface: failureContext.surface,
    operation: failureContext.operation,
    stage,
    transactionHash: failureContext.transactionHash,
    normalizedReason,
  });
  if (shouldSkipDuplicateFailure(dedupeKey)) {
    return;
  }

  const walletIdentity = await resolveUserIdentity(failureContext.walletAddress);
  const sanitizedError = error instanceof Error ? error : new Error(readableMessage);
  const vrfNotConsumed = isVrfNotConsumedError(error);
  const hasTransactionHash = failureContext.hasTxHash ?? Boolean(failureContext.transactionHash);
  const tags = {
    feature: "transactions",
    "tx.surface": failureContext.surface,
    "tx.stage": stage,
    ...(failureContext.transactionType ? { "tx.type": failureContext.transactionType } : {}),
    ...(failureContext.failureKind ? { "tx.failure_kind": failureContext.failureKind } : {}),
    ...(failureContext.providerState ? { provider_state: failureContext.providerState } : {}),
    ...(failureContext.chain ? { chain: failureContext.chain } : {}),
    ...(failureContext.worldName ? { world: failureContext.worldName } : {}),
    has_tx_hash: hasTransactionHash ? "true" : "false",
    ...(vrfNotConsumed ? { "tx.vrf_not_consumed": "true" } : {}),
  };
  const transactionContext = sanitizeValue({
    operation: failureContext.operation,
    stage,
    transactionType: failureContext.transactionType,
    transactionHash: failureContext.transactionHash,
    failureKind: failureContext.failureKind,
    providerState: failureContext.providerState,
    hasTxHash: hasTransactionHash,
    retrySafety: failureContext.retrySafety,
    transactionCount: failureContext.transactionCount,
    entrypoints: failureContext.entrypoints,
    contractAddresses: failureContext.contractAddresses,
    rpcHost: failureContext.rpcHost,
  });
  const batchContext =
    failureContext.batchDetails && failureContext.batchDetails.length > 0
      ? sanitizeValue({ details: failureContext.batchDetails })
      : undefined;
  const worldContext =
    failureContext.chain || failureContext.worldName || failureContext.worldAddress
      ? sanitizeValue({
          chain: failureContext.chain,
          worldName: failureContext.worldName,
          worldAddress: failureContext.worldAddress,
        })
      : undefined;
  const walletContext =
    resolveWalletIdentityMode() === "none"
      ? undefined
      : sanitizeValue({
          id: walletIdentity,
          mode: resolveWalletIdentityMode(),
        });

  Sentry.captureException(sanitizedError, {
    tags,
    user: walletIdentity ? { id: walletIdentity } : undefined,
    contexts: {
      transaction: transactionContext as Record<string, unknown>,
      ...(walletContext ? { wallet: walletContext as Record<string, unknown> } : {}),
      ...(worldContext ? { world: worldContext as Record<string, unknown> } : {}),
      ...(batchContext ? { batch: batchContext as Record<string, unknown> } : {}),
    },
    extra: sanitizeValue({
      normalizedReason,
      originalError: error,
    }) as Record<string, unknown>,
    fingerprint: buildFingerprint({
      surface: failureContext.surface,
      stage,
      transactionType: failureContext.transactionType,
      operation: failureContext.operation,
      normalizedReason,
      failureKind: failureContext.failureKind,
    }),
  });
};
