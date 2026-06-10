import type { TransactionSubmitFailureKind } from "@bibliothecadao/provider";

const unresolvedSubmissionKeys = new Set<string>();
const CLAIM_SHARE_POINTS_OPERATION = "claim_share_points";

export const isNoHashSubmissionTimeout = (error: unknown): boolean => {
  return error instanceof Error && error.message.includes("before a transaction hash was returned");
};

const buildUncertainSubmissionKey = ({
  operation,
  walletAddress,
}: {
  operation: string;
  walletAddress: string | bigint;
}): string => `${operation}:${walletAddress.toString()}`;

export const buildClaimSharePointsSubmissionKey = (walletAddress: string | bigint): string => {
  return buildUncertainSubmissionKey({
    operation: CLAIM_SHARE_POINTS_OPERATION,
    walletAddress,
  });
};

export const rememberUncertainSubmission = ({
  key,
  failureKind,
}: {
  key: string;
  failureKind?: TransactionSubmitFailureKind;
}): void => {
  if (failureKind === "submission_timeout_no_hash") {
    unresolvedSubmissionKeys.add(key);
    return;
  }

  unresolvedSubmissionKeys.delete(key);
};

export const hasUnresolvedUncertainSubmission = (key: string): boolean => unresolvedSubmissionKeys.has(key);

export const clearUncertainSubmission = (key: string): void => {
  unresolvedSubmissionKeys.delete(key);
};

export const rememberUncertainClaimSharePointsSubmission = ({
  walletAddress,
  failureKind,
}: {
  walletAddress: string | bigint;
  failureKind?: TransactionSubmitFailureKind;
}): void => {
  rememberUncertainSubmission({
    key: buildClaimSharePointsSubmissionKey(walletAddress),
    failureKind,
  });
};

export const shouldSkipAutomaticClaimSharePointsSubmission = (walletAddress: string | bigint): boolean => {
  return hasUnresolvedUncertainSubmission(buildClaimSharePointsSubmissionKey(walletAddress));
};

export const clearUncertainClaimSharePointsSubmission = (walletAddress: string | bigint): void => {
  clearUncertainSubmission(buildClaimSharePointsSubmissionKey(walletAddress));
};

export const resetUncertainSubmissionRegistryForTests = (): void => {
  unresolvedSubmissionKeys.clear();
};
