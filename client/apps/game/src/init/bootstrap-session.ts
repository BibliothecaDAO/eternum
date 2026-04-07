export interface BootstrapSelection {
  chain: string | null;
  worldName: string | null;
}

type BootstrapResetReason = "chain-changed" | "world-changed";

export interface BootstrapSession<TResult> {
  clearFailure(): void;
  getCachedResult(): TResult | null;
  getResetReason(nextSelection: BootstrapSelection): BootstrapResetReason | null;
  getTrackedSelection(): BootstrapSelection;
  replaceRendererCleanup(cleanup: (() => void) | null): void;
  reset(): void;
  run(selection: BootstrapSelection, execute: () => Promise<TResult>): Promise<TResult>;
}

export function createBootstrapSession<TResult>(): BootstrapSession<TResult> {
  let cachedResult: TResult | null = null;
  let promise: Promise<TResult> | null = null;
  let rendererCleanup: (() => void) | null = null;
  let trackedSelection: BootstrapSelection = { chain: null, worldName: null };

  const clearSessionState = () => {
    cachedResult = null;
    promise = null;
    trackedSelection = { chain: null, worldName: null };
  };

  return {
    clearFailure() {
      clearSessionState();
    },

    getCachedResult() {
      return cachedResult;
    },

    getResetReason(nextSelection) {
      if (!promise) {
        return null;
      }

      if (trackedSelection.chain && nextSelection.chain && trackedSelection.chain !== nextSelection.chain) {
        return "chain-changed";
      }

      if (trackedSelection.worldName !== nextSelection.worldName) {
        return "world-changed";
      }

      return null;
    },

    getTrackedSelection() {
      return { ...trackedSelection };
    },

    replaceRendererCleanup(cleanup) {
      if (rendererCleanup === cleanup) {
        return;
      }

      rendererCleanup?.();
      rendererCleanup = cleanup;
    },

    reset() {
      this.replaceRendererCleanup(null);
      clearSessionState();
    },

    run(selection, execute) {
      if (!promise) {
        trackedSelection = { ...selection };
        promise = execute().then((result) => {
          cachedResult = result;
          return result;
        });
      }

      return promise;
    },
  };
}
