import { useCallback, useMemo, useSyncExternalStore } from "react";
import { latestFeatures } from "@/ui/features/world/latest-features";

const STORAGE_KEY = "eternum-latest-features-seen";

const getSnapshot = (): string | null => {
  return localStorage.getItem(STORAGE_KEY);
};

const subscribe = (callback: () => void): (() => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

export const useLatestFeaturesSeen = () => {
  const lastSeenDate = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const unseenCount = useMemo(() => {
    if (!lastSeenDate) {
      return latestFeatures.length;
    }

    const lastSeen = new Date(lastSeenDate);
    return latestFeatures.filter((feature) => new Date(feature.date) > lastSeen).length;
  }, [lastSeenDate]);

  const markAsSeen = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, now);
    window.dispatchEvent(new Event("storage"));
  }, []);

  const hasUnseenFeatures = unseenCount > 0;

  return {
    unseenCount,
    hasUnseenFeatures,
    markAsSeen,
    lastSeenDate,
  };
};
