import type { NativeKeys, NativeModelName, NativeRows } from "@bibliothecadao/eternum/game-client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useGame } from "@/hooks/context/game-context";

export const useNativeRevision = (models: readonly NativeModelName[]): number => {
  const {
    setup: { store },
  } = useGame();
  const subscribe = useCallback(
    (changed: () => void) =>
      store.subscribe((changes) => {
        if (changes.length === 0 || changes.some((change) => models.includes(change.model))) changed();
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

/** Missing sparse facts are readable only through the schema's declared absence gate. */
export const useNativeRowOrAbsent = <M extends NativeModelName>(
  model: M,
  keys: NativeKeys[M] | undefined,
): NativeRows[M] | undefined => {
  const {
    setup: { store },
  } = useGame();
  // Parent removal and snapshot replacement can change the gate without writing this sparse model.
  const subscribe = useCallback((changed: () => void) => store.subscribe(changed), [store]);
  const revision = useSyncExternalStore(subscribe, store.getRevision, store.getRevision);
  const key =
    keys === undefined
      ? undefined
      : JSON.stringify(keys, (_field, value) => (typeof value === "bigint" ? value.toString() : value));
  return useMemo(
    () => (key === undefined ? undefined : store.requireOrAbsent(model, JSON.parse(key)).known),
    [store, model, key, revision],
  );
};
