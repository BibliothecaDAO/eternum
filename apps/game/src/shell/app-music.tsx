import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";

/**
 * Music outside a match (ruled 8 October 2026): off until the player turns it on, then remembered on this device. The
 * player and its tracks load only once it is on and the page has had a tap or a key, as browsers start sound only then.
 */
const KEY = "realms.app-music";
const listeners = new Set<() => void>();

const readOn = (): boolean => {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
};

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

export const useAppMusic = () => useSyncExternalStore(subscribe, readOn, () => false);

/** Turning it on also lifts a mute set in a match: the player has just asked for sound. */
export const setAppMusic = (on: boolean) => {
  try {
    if (on) localStorage.setItem(KEY, "on");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage refused (a private window): the switch still answers for this visit.
  }
  if (on)
    void import("@/audio/core/AudioManager").then(({ AudioManager }) => AudioManager.getInstance().setMuted(false));
  listeners.forEach((listener) => listener());
};

const MusicPlayer = lazy(() => import("./music-player"));

export const AppMusic = () => {
  const on = useAppMusic();
  const active = useHasBeenActive();
  return on && active ? (
    <Suspense fallback={null}>
      <MusicPlayer />
    </Suspense>
  ) : null;
};

const hasBeenActive = () => navigator.userActivation?.hasBeenActive ?? false;

const useHasBeenActive = () => {
  const [active, setActive] = useState(hasBeenActive);
  useEffect(() => {
    if (active) return;
    const onGesture = () => setActive(true);
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [active]);
  return active;
};
