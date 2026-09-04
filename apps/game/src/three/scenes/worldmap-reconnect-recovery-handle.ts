export interface ActiveWorldmapRecoveryHandle {
  refreshAfterReconnect: () => void;
  recoverAfterConnectionFailure: () => void;
}

let activeWorldmapRecoveryHandle: ActiveWorldmapRecoveryHandle | null = null;

export function registerActiveWorldmapRecoveryHandle(handle: ActiveWorldmapRecoveryHandle): () => void {
  activeWorldmapRecoveryHandle = handle;

  return () => {
    if (activeWorldmapRecoveryHandle === handle) {
      activeWorldmapRecoveryHandle = null;
    }
  };
}

export function getActiveWorldmapRecoveryHandle(): ActiveWorldmapRecoveryHandle | null {
  return activeWorldmapRecoveryHandle;
}

export function clearActiveWorldmapRecoveryHandle(): void {
  activeWorldmapRecoveryHandle = null;
}
