import type { SocialProvider } from "@realms-world/identity";

/**
 * A provider's sign-in this browser started and has not finished: which provider, and where it was taking the player.
 * It outlives a reload (an iPhone may reload its home-screen app while the provider finishes in Safari's view), so
 * Connect comes back on that provider's step, ready for the code the other browser shows, without asking it again. It
 * lasts as long as the identity Worker holds the attempt.
 */
export type SocialPending = { provider: SocialProvider; next: string | null; startedAt: number };

const KEY = "realms:social-pending";
const LIFETIME_MS = 10 * 60_000;

export const rememberSocialStart = (provider: SocialProvider, next: string | null, now = Date.now()) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ provider, next, startedAt: now } satisfies SocialPending));
  } catch {
    // Without storage the step still shows until the page reloads.
  }
};

export const forgetSocialStart = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was kept.
  }
};

/** The provider sign-in still pending here, or null once it is done, abandoned or too old to finish. */
export const pendingSocialStart = (now = Date.now()): SocialPending | null => {
  let pending: SocialPending | null = null;
  try {
    pending = JSON.parse(localStorage.getItem(KEY) ?? "null") as SocialPending | null;
  } catch {
    return null;
  }
  if (!pending || typeof pending.startedAt !== "number" || now - pending.startedAt >= LIFETIME_MS) {
    forgetSocialStart();
    return null;
  }
  return pending;
};
