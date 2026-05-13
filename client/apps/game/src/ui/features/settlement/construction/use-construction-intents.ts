import { useSyncExternalStore } from "react";
import { getConstructionIntentSnapshot, subscribeConstructionIntentChanges } from "./construction-intent-store";

export const useConstructionIntentVersion = () =>
  useSyncExternalStore(
    subscribeConstructionIntentChanges,
    getConstructionIntentSnapshot,
    getConstructionIntentSnapshot,
  );
