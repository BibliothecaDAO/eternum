type RefreshPoliciesFn = () => Promise<boolean>;

interface RefreshBootstrapPoliciesParams {
  connector: unknown | null | undefined;
  isSpectateMode: boolean;
  refreshPolicies: RefreshPoliciesFn;
}

export const refreshBootstrapPoliciesIfNeeded = async ({
  connector,
  isSpectateMode,
  refreshPolicies,
}: RefreshBootstrapPoliciesParams): Promise<boolean> => {
  if (!connector || isSpectateMode) {
    return false;
  }

  return refreshPolicies();
};
