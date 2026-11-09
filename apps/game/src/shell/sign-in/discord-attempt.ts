import { useCallback, useEffect, useRef, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { pageNavigation } from "@/utils/page-navigation";

import { openDiscordSignIn } from "./discord-app";

/**
 * The Connect window's one Discord sign-in attempt: the authorize address the identity service gave it, opened in the
 * app, in the browser or again, and nothing more once the window let it go.
 *
 * - The app opens only from a tap that already holds the address: a browser hands a page to another app only from a
 *   tap, and a slow answer would outlast it (Chrome: developer.chrome.com/docs/android/intents). `asking` says an
 *   address is on its way, so the button can wait for it instead of taking a tap it cannot use.
 * - With `early`, a phone asks for the address as soon as Discord is offered, and again before it grows too old.
 * - Each new address marks this browser as the one its sign-in belongs to (discord-handoff.ts), so an attempt keeps its
 *   address for the app, the browser and a retry, and asks for none while it is under way.
 * - Closing the window, signing in (the window goes) or opening again stops what an earlier launch still had to do, and
 *   an address that comes back for an attempt the window let go opens nothing.
 */
export const useDiscordAttempt = (returnTo: string, early: boolean) => {
  const attempt = useRef<Attempt | null>(null);
  const stopLaunch = useRef(() => {});
  const open = useRef(true);
  const [asking, setAsking] = useState(false);

  const begin = useCallback(() => {
    const started = startAttempt(returnTo);
    attempt.current = started;
    setAsking(true);
    // A refused ask leaves no attempt: the next tap asks again and shows that answer's failure.
    void started.answer
      .catch(() => null)
      .then((address) => {
        if (attempt.current !== started) return;
        if (address === null) attempt.current = null;
        setAsking(false);
      });
    return started;
  }, [returnTo]);

  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
      stopLaunch.current();
    };
  }, []);

  useEffect(() => {
    if (!early) return;
    begin();
    const renew = window.setInterval(begin, FRESH_MS);
    return () => window.clearInterval(renew);
  }, [begin, early]);

  const current = () => {
    const live = attempt.current;
    return live && live.returnTo === returnTo && Date.now() - live.startedAt < FRESH_MS ? live : null;
  };

  return {
    /** Whether an address is on its way. */
    asking,
    /** The attempt's address, when it is already known: a tap can then open it from inside itself. */
    ready: (): string | null => current()?.address ?? null,
    /** Waits for the attempt's address, asking for one if none is under way; null once the window let it go. */
    fetch: async (): Promise<string | null> => {
      const asked = current() ?? begin();
      const address = await asked.answer;
      return open.current && attempt.current === asked ? address : null;
    },
    /** Opens the address in a phone's app, from inside the tap, stopping what an earlier launch still had to do. */
    inApp: (address: string) => {
      stopLaunch.current();
      stopLaunch.current = openDiscordSignIn(address);
    },
    /** Opens the address in this browser: a computer's way, and a phone player's choice over the app. */
    inBrowser: (address: string) => {
      stopLaunch.current();
      pageNavigation.open(address);
    },
  };
};

/** better-auth keeps a sign-in's state for 10 minutes; an address is used, or asked again, well inside that. */
const FRESH_MS = 8 * 60_000;

type Attempt = { returnTo: string; startedAt: number; answer: Promise<string>; address: string | null };

const startAttempt = (returnTo: string): Attempt => {
  const attempt: Attempt = {
    returnTo,
    startedAt: Date.now(),
    answer: identityClient.discordSignInUrl(returnTo),
    address: null,
  };
  void attempt.answer.then((address) => (attempt.address = address)).catch(() => {});
  return attempt;
};
