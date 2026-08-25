export const CHAIN_TIME_DEBUG_STORAGE_KEY = "ETERNUM_CHAIN_TIME_DEBUG";

const isDebugQueryParamEnabled = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return new URLSearchParams(window.location.search).get("chainTimeDebug") === "1";
  } catch {
    return false;
  }
};

const isChainTimeDebugEnabled = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  if (isDebugQueryParamEnabled()) {
    return true;
  }

  try {
    const value = window.localStorage.getItem(CHAIN_TIME_DEBUG_STORAGE_KEY);
    return value === "1" || value === "true";
  } catch {
    return false;
  }
};

export const logChainTimeDebug = (event: string, payload: Record<string, unknown>) => {
  if (!isChainTimeDebugEnabled()) {
    return;
  }

  console.info(`[chain-time][${event}]`, payload);
};
