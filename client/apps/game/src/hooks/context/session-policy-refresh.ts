/**
 * Refreshes Cartridge Controller session policies using the official
 * updateSession() API introduced in controller 0.13.x.
 */
import { dojoConfig } from "../../../dojo-config";
import { buildPolicies } from "./policies";

let _lastSignedScope: string | null = null;
let _lastSignedPolicyHash: string | null = null;
let _lastSignedSignerKey: string | null = null;
let _isRefreshingPolicies = false;

const canonicalizeForHash = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeForHash(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).toSorted();
    const canonicalRecord: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      canonicalRecord[key] = canonicalizeForHash(record[key]);
    }
    return canonicalRecord;
  }

  return value;
};

const hashPolicies = (policies: unknown): string => {
  try {
    return JSON.stringify(canonicalizeForHash(policies), (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
  } catch {
    return "";
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getProvider = (connector: any): any => connector?.controller ?? connector;

const normalizeSignerKey = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed.toLowerCase() : null;
  }

  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`;
  }

  return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSignerKey = (connector: any, provider: any): string | null => {
  return (
    normalizeSignerKey(provider?.account?.address) ??
    normalizeSignerKey(provider?.address) ??
    normalizeSignerKey(connector?.account?.address) ??
    normalizeSignerKey(connector?.address)
  );
};

const updateSessionPolicies = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connector: any,
  policies: unknown,
  scope: string,
): Promise<boolean> => {
  const nextHash = hashPolicies(policies);
  if (!nextHash) {
    return false;
  }

  const provider = getProvider(connector);
  if (!provider?.updateSession) {
    return false;
  }

  // Sign once per active world scope and re-sign only when switching scope.
  // This avoids duplicate prompts within the same world bootstrap flow.
  const signerKey = getSignerKey(connector, provider);
  if (_lastSignedScope === scope && _lastSignedSignerKey === signerKey) {
    return false;
  }

  _isRefreshingPolicies = true;
  try {
    await provider.updateSession({ policies });
    _lastSignedScope = scope;
    _lastSignedPolicyHash = nextHash;
    _lastSignedSignerKey = signerKey;
    return true;
  } finally {
    _isRefreshingPolicies = false;
  }
};

export const isSessionPolicyRefreshInProgress = (): boolean => _isRefreshingPolicies;
export const hasSessionPoliciesForScope = (scope: string): boolean =>
  _lastSignedScope === scope && _lastSignedPolicyHash !== null;

/**
 * Refresh policies derived from dojoConfig.manifest (full world policy set).
 */
export const refreshSessionPolicies = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connector: any,
  scope = "world",
): Promise<boolean> => {
  const newPolicies = buildPolicies(dojoConfig.manifest);
  return updateSessionPolicies(connector, newPolicies, scope);
};

/**
 * Refresh policies with an explicit policy payload (used for on-demand flows
 * such as forge mode where only a subset of calls is required).
 */
export const refreshSessionPoliciesWithPolicies = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connector: any,
  policies: unknown,
  scope = "custom",
): Promise<boolean> => {
  return updateSessionPolicies(connector, policies, scope);
};
