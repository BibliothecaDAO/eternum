let isRefreshingPolicies = false;
const refreshWaiters = new Set<() => void>();

export const isSessionPolicyRefreshInProgress = (): boolean => isRefreshingPolicies;

export const setSessionPolicyRefreshInProgress = (nextValue: boolean): void => {
  isRefreshingPolicies = nextValue;
};

export const resolveSessionPolicyRefreshWaiters = (): void => {
  for (const resolve of refreshWaiters) {
    resolve();
  }
  refreshWaiters.clear();
};

export const waitForSessionPolicyRefresh = async (): Promise<void> => {
  if (!isRefreshingPolicies) {
    return;
  }

  await new Promise<void>((resolve) => {
    refreshWaiters.add(resolve);
  });
};
