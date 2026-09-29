import { useCallback, useEffect, useState } from "react";
import { GUIDE_STEPS } from "./guide-script";

/**
 * Which of Ysolde's lines this viewer has seen: a per-viewer convenience in localStorage, one list per game and player.
 * Storage that throws or is blocked only means the guide may repeat itself; the session copy keeps it working.
 */
const storageKey = (gameId: number, player: string) => `frontier-guide:${gameId}:${player.toLowerCase()}`;
const sessionSeen = new Map<string, Set<string>>();
const REPLAY_EVENT = "frontier-guide-replay";

const readSeen = (key: string): Set<string> => {
  const session = sessionSeen.get(key);
  if (session) return session;
  let stored: Set<string> = new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) stored = new Set((JSON.parse(raw) as unknown[]).filter((id): id is string => typeof id === "string"));
  } catch {
    // Unreadable storage: the guide starts from the beginning.
  }
  sessionSeen.set(key, stored);
  return stored;
};

const writeSeen = (key: string, seen: Set<string>) => {
  sessionSeen.set(key, seen);
  try {
    window.localStorage.setItem(key, JSON.stringify([...seen]));
  } catch {
    // Storage refused: the session copy still holds.
  }
};

export const useGuideSeen = (gameId: number, player: string | null) => {
  const key = player ? storageKey(gameId, player) : null;
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => (key ? readSeen(key) : new Set()));
  const markSeen = useCallback(
    (ids: readonly string[]) => {
      if (!key) return;
      const next = new Set([...readSeen(key), ...ids]);
      writeSeen(key, next);
      setSeen(next);
    },
    [key],
  );
  // A replay from settings resets the mounted guide too.
  useEffect(() => {
    if (!key) return;
    const reset = () => setSeen(readSeen(key));
    window.addEventListener(REPLAY_EVENT, reset);
    return () => window.removeEventListener(REPLAY_EVENT, reset);
  }, [key]);
  const skipAll = useCallback(() => markSeen(GUIDE_STEPS.map((step) => step.id)), [markSeen]);
  return { seen, markSeen, skipAll };
};

/** Settings' replay: forget every line this viewer has seen in this game, so the guide starts over. */
export const replayGuide = (gameId: number, player: string): void => {
  writeSeen(storageKey(gameId, player), new Set());
  window.dispatchEvent(new Event(REPLAY_EVENT));
};
