import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { useCallback, useSyncExternalStore } from "react";

export const useProvisionalInputLock = (model: string, entityIds: readonly string[]): boolean => {
  const runtime = getActiveGameSyncRuntime();
  const subscribe = useCallback(
    (listener: () => void) => runtime?.subscribeProvisionalState(listener) ?? (() => {}),
    [runtime],
  );
  const getSnapshot = useCallback(
    () => entityIds.some((entityId) => runtime?.hasProvisionalInputLock(model, entityId) ?? false),
    [entityIds, model, runtime],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
