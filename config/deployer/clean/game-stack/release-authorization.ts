export function assertProductionReleaseAuthorized(value: unknown): void {
  const decision = asReleaseDecision(value);
  if (decision.decision !== "GO" || decision.releaseReady !== true || decision.productionStartAuthorized !== true) {
    throw new Error("Production launch is blocked by the current A23 Wave 0 release decision");
  }
  throw new Error("Production launch requires a cryptographically verified A23 authorization artifact");
}

function asReleaseDecision(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("A23 Wave 0 release decision is unavailable or malformed");
  }
  return value as Record<string, unknown>;
}
