import { useCallback, useState } from "react";
import { GUIDE_OFF } from "./guide-script";

/**
 * Which of the guide's lines this viewer has seen: a per-viewer convenience in localStorage, one list per game and player.
 * Storage that throws or is blocked only means the guide may repeat itself; the session copy keeps it working.
 */
const storageKey = (gameId: number, player: string) => `frontier-guide:${gameId}:${player.toLowerCase()}`;
const sessionSeen = new Map<string, Set<string>>();

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
  const write = useCallback(
    (change: (seen: Set<string>) => void) => {
      if (!key) return;
      const next = new Set(readSeen(key));
      change(next);
      writeSeen(key, next);
      setSeen(next);
    },
    [key],
  );
  const markSeen = useCallback((ids: readonly string[]) => write((next) => ids.forEach((id) => next.add(id))), [write]);
  // Off keeps every line the player has seen, to re-read; on again goes on from the next line not yet seen.
  const turnOff = useCallback(() => write((next) => next.add(GUIDE_OFF)), [write]);
  const turnOn = useCallback(() => write((next) => next.delete(GUIDE_OFF)), [write]);
  return { seen, markSeen, turnOff, turnOn };
};
