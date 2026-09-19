import type { NativeKeys, NativeModelName, NativeRows } from "@bibliothecadao/eternum/game-client";
import { useCallback, useSyncExternalStore } from "react";
import { useGame } from "../context";

export const useNativeRevision = (models: readonly NativeModelName[]): number => {
  const {
    setup: { store },
  } = useGame();
  const subscribe = useCallback(
    (changed: () => void) =>
      store.subscribe((changes) => {
        if (changes.some((change) => models.includes(change.model))) changed();
      }),
    [store, models],
  );
  return useSyncExternalStore(subscribe, store.getRevision, store.getRevision);
};

export const useNativeRow = <M extends NativeModelName>(
  model: M,
  keys: NativeKeys[M] | undefined,
): NativeRows[M] | undefined => {
  const {
    setup: { store },
  } = useGame();
  const subscribe = useCallback(
    (changed: () => void) =>
      store.subscribe((changes) => {
        if (changes.some((change) => change.model === model)) changed();
      }),
    [store, model],
  );
  const read = () => (keys ? store.get(model, keys) : undefined);
  return useSyncExternalStore(subscribe, read, read);
};
