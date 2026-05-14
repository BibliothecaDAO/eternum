export const BLITZ_SETTLE_GRANT_STARTING_TROOPS_STORAGE_KEY = "BLITZ_SETTLE_GRANT_STARTING_TROOPS";

type StorageReader = Pick<Storage, "getItem">;

const resolveLocalStorageReader = (): StorageReader | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const resolveBlitzGrantStartingTroops = ({
  isDev = import.meta.env.DEV,
  storage = resolveLocalStorageReader(),
}: {
  isDev?: boolean;
  storage?: StorageReader | null;
} = {}): boolean => {
  if (!isDev) {
    return true;
  }

  try {
    return storage?.getItem(BLITZ_SETTLE_GRANT_STARTING_TROOPS_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
};
