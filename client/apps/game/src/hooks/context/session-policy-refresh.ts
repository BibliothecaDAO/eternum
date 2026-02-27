/**
 * Refreshes Cartridge Controller session policies using the official
 * updateSession() API introduced in controller 0.13.x.
 */
import { dojoConfig } from "../../../dojo-config";
import { buildPolicies } from "./policies";

const _lastPolicyHashByScope = new Map<string, string>();
let _isRefreshingPolicies = false;

const hashPolicies = (policies: unknown): string => {
  try {
    return JSON.stringify(policies);
  } catch {
    return "";
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getProvider = (connector: any): any => connector?.controller ?? connector;

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

  if (_lastPolicyHashByScope.get(scope) === nextHash) {
    return false;
  }

  const provider = getProvider(connector);
  if (!provider?.updateSession) {
    return false;
  }

  _isRefreshingPolicies = true;
  try {
    await provider.updateSession({ policies });
    _lastPolicyHashByScope.set(scope, nextHash);
    return true;
  } finally {
    _isRefreshingPolicies = false;
  }
};

export const isSessionPolicyRefreshInProgress = (): boolean => _isRefreshingPolicies;

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
