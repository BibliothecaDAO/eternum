import type { SocialProvider } from "@realms-world/identity";
import { useCallback, useEffect, useRef, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { pageNavigation } from "@/utils/page-navigation";

import { openDiscordSignIn } from "./discord-app";

/**
 * The Connect window's one provider sign-in attempt: the authorize address the identity service gave it for a
 * provider, opened in the browser, again, or (Discord on a phone) in the app, and nothing more once the window let it
 * go.
 *
 * - Each new address marks this browser as the one its sign-in belongs to (social-handoff.ts), so an attempt keeps its
 *   address for every way it is opened and asks for none while it is under way.
 * - An attempt the player asked for is theirs until it is refused or the window goes: a background ask (Discord's
 *   early address) never replaces it, so whichever provider the player chose is the one that opens.
 * - Closing the window, signing in (the window goes), opening again or ending the attempt (`end`: the player chose
 *   another way in) stops what an earlier launch still had to do, and an address that comes back for an attempt the
 *   window let go opens nothing.
 * - The Discord app opens only from a tap that already holds the address: a browser hands a page to another app only
 *   from a tap, and a slow answer would outlast it (Chrome: developer.chrome.com/docs/android/intents). `asking` names
 *   the provider whose address is on its way, so its button can wait for it instead of taking a tap it cannot use.
 *   With `early`, a phone asks for Discord's address as soon as Discord is offered, and again before it grows too old.
 */
export const useSocialAttempt = (returnTo: string, early: SocialProvider | null) => {
  const attempt = useRef<Attempt | null>(null);
  const stopLaunch = useRef(() => {});
  const open = useRef(true);
  const [asking, setAsking] = useState<SocialProvider | null>(null);

  const begin = useCallback(
    (provider: SocialProvider, owner: Owner) => {
      const started = startAttempt(provider, returnTo, owner);
      attempt.current = started;
      setAsking(provider);
      // A refused ask leaves no attempt: the next tap asks again and shows that answer's failure.
      void started.answer
        .catch(() => null)
        .then((address) => {
          if (attempt.current !== started) return;
          if (address === null) attempt.current = null;
          setAsking(null);
        });
      return started;
    },
    [returnTo],
  );

  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
      stopLaunch.current();
    };
  }, []);

  useEffect(() => {
    if (!early) return;
    const prefetch = () => {
      if (attempt.current?.owner !== "player") begin(early, "background");
    };
    prefetch();
    const renew = window.setInterval(prefetch, FRESH_MS);
    return () => window.clearInterval(renew);
  }, [begin, early]);

  const current = (provider: SocialProvider) => {
    const live = attempt.current;
    return live && live.provider === provider && live.returnTo === returnTo && Date.now() - live.startedAt < FRESH_MS
      ? live
      : null;
  };

  return {
    /** The provider whose address is on its way, if any. */
    asking,
    /** The provider's address when it is already known, now the player's: a tap can open it from inside itself. */
    claim: (provider: SocialProvider): string | null => {
      const live = current(provider);
      if (live === null || live.address === null) return null;
      live.owner = "player";
      return live.address;
    },
    /** Waits for the provider's address, asking for one if none is under way; null once the window let it go. */
    fetch: async (provider: SocialProvider): Promise<string | null> => {
      const asked = current(provider) ?? begin(provider, "player");
      asked.owner = "player";
      const address = await asked.answer;
      return open.current && attempt.current === asked ? address : null;
    },
    /** Lets the attempt go: its launch stops, and its address, still on its way or known, opens nothing. */
    end: () => {
      stopLaunch.current();
      stopLaunch.current = () => {};
      attempt.current = null;
      setAsking(null);
    },
    /** Opens Discord's address in a phone's app, from inside the tap, stopping what an earlier launch still had to do. */
    inApp: (address: string) => {
      stopLaunch.current();
      stopLaunch.current = openDiscordSignIn(address);
    },
    /** Opens the address in this browser: every provider's way, and a phone player's choice over the Discord app. */
    inBrowser: (address: string) => {
      stopLaunch.current();
      pageNavigation.open(address);
    },
  };
};

/** better-auth keeps a sign-in's state for 10 minutes; an address is used, or asked again, well inside that. */
const FRESH_MS = 8 * 60_000;

/** Who asked: the player's tap, or the window ahead of it. */
type Owner = "player" | "background";

type Attempt = {
  provider: SocialProvider;
  owner: Owner;
  returnTo: string;
  startedAt: number;
  answer: Promise<string>;
  address: string | null;
};

const startAttempt = (provider: SocialProvider, returnTo: string, owner: Owner): Attempt => {
  const attempt: Attempt = {
    provider,
    owner,
    returnTo,
    startedAt: Date.now(),
    answer: identityClient.socialSignInUrl(provider, returnTo),
    address: null,
  };
  void attempt.answer.then((address) => (attempt.address = address)).catch(() => {});
  return attempt;
};
