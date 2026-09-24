export interface BootstrapSelection {
  cacheKey: string | null;
}

type BootstrapResetReason = "game-changed";

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
  let trackedSelection: BootstrapSelection = { cacheKey: null };

  const clearSessionState = () => {
    cachedResult = null;
    promise = null;
    trackedSelection = { cacheKey: null };
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

      return trackedSelection.cacheKey === nextSelection.cacheKey ? null : "game-changed";
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
