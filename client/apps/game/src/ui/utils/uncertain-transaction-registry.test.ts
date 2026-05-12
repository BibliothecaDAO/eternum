import { describe, expect, it } from "vitest";
import {
  buildClaimSharePointsSubmissionKey,
  clearUncertainSubmission,
  clearUncertainClaimSharePointsSubmission,
  hasUnresolvedUncertainSubmission,
  isNoHashSubmissionTimeout,
  rememberUncertainClaimSharePointsSubmission,
  rememberUncertainSubmission,
  resetUncertainSubmissionRegistryForTests,
  shouldSkipAutomaticClaimSharePointsSubmission,
} from "./uncertain-transaction-registry";

describe("uncertain transaction registry", () => {
  it("records unresolved claim share-points no-hash submissions and skips automatic retry until cleared", () => {
    resetUncertainSubmissionRegistryForTests();
    const walletAddress = "0xabc";
    const key = buildClaimSharePointsSubmissionKey(walletAddress);

    expect(hasUnresolvedUncertainSubmission(key)).toBe(false);
    expect(shouldSkipAutomaticClaimSharePointsSubmission(walletAddress)).toBe(false);

    rememberUncertainClaimSharePointsSubmission({
      walletAddress,
      failureKind: "submission_timeout_no_hash",
    });

    expect(hasUnresolvedUncertainSubmission(key)).toBe(true);
    expect(shouldSkipAutomaticClaimSharePointsSubmission(walletAddress)).toBe(true);

    clearUncertainClaimSharePointsSubmission(walletAddress);

    expect(hasUnresolvedUncertainSubmission(key)).toBe(false);
    expect(shouldSkipAutomaticClaimSharePointsSubmission(walletAddress)).toBe(false);
  });

  it("does not block automatic retries for provider disconnects that failed before submit", () => {
    resetUncertainSubmissionRegistryForTests();
    const key = "claim_share_points:0xabc";

    rememberUncertainSubmission({
      key,
      failureKind: "provider_connection_destroyed",
    });

    expect(hasUnresolvedUncertainSubmission(key)).toBe(false);
  });

  it("classifies no-hash timeout errors from provider messages", () => {
    const timeout = new Error("Transaction submission timed out after 20s before a transaction hash was returned");

    expect(isNoHashSubmissionTimeout(timeout)).toBe(true);
    expect(isNoHashSubmissionTimeout(new Error("connection destroyed"))).toBe(false);
  });
});
