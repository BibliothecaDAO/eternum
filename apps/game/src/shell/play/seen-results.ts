/**
 * The finished games whose results this device has opened, in any mode: a convenience, so losing it only offers their
 * Results on Play again. Browser storage can be absent or refuse, so every read and write may fail quietly.
 */
const KEY = "realms.seen-results";

export const readSeenResults = (): ReadonlySet<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
};

export const markResultsSeen = (gameKey: string): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify([...readSeenResults(), gameKey]));
  } catch {
    // A refused write only shows the card again.
  }
};
