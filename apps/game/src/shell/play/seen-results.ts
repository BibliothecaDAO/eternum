/**
 * The finished seasons whose results this device has opened: a convenience (spec 03), so losing it only shows the
 * season-over card again. Browser storage can be absent or refuse, so every read and write may fail quietly.
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
