/**
 * A Discord sign-in this browser started and has not finished: where it was taking the player. It outlives a reload
 * (an iPhone may reload its home-screen app while Discord finishes in Safari's view), so Connect comes back on the
 * Discord step, ready for the code the other browser shows, without asking Discord again. It lasts as long as the
 * identity Worker holds the attempt.
 */
export type DiscordPending = { next: string | null; startedAt: number };

const KEY = "realms:discord-pending";
const LIFETIME_MS = 10 * 60_000;

export const rememberDiscordStart = (next: string | null, now = Date.now()) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ next, startedAt: now } satisfies DiscordPending));
  } catch {
    // Without storage the step still shows until the page reloads.
  }
};

export const forgetDiscordStart = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was kept.
  }
};

/** The Discord sign-in still pending here, or null once it is done, abandoned or too old to finish. */
export const pendingDiscordStart = (now = Date.now()): DiscordPending | null => {
  let pending: DiscordPending | null = null;
  try {
    pending = JSON.parse(localStorage.getItem(KEY) ?? "null") as DiscordPending | null;
  } catch {
    return null;
  }
  if (!pending || typeof pending.startedAt !== "number" || now - pending.startedAt >= LIFETIME_MS) {
    forgetDiscordStart();
    return null;
  }
  return pending;
};
