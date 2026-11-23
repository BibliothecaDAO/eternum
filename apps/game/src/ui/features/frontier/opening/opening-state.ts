import { OPENING, OPENING_MOMENTS, type OpeningMoment, type StateMoment } from "./opening";

/** What the Realm holds or has done, read from the game's state, that opens a moment on its own. */
export type OpeningHeld = Record<StateMoment, boolean>;

const isStateMoment = (moment: OpeningMoment, held: OpeningHeld): moment is StateMoment => moment in held;

/** The moments the Realm's state has reached: the launch always, and each moment whose state is held. */
export const reachedOnState = (held: OpeningHeld | null): OpeningMoment[] =>
  OPENING_MOMENTS.filter(
    (moment) => moment === "launch" || (held !== null && isStateMoment(moment, held) && held[moment]),
  );

/**
 * The moments the interface has opened to: those the account has reached before, in any session or on any device, and
 * those the state reaches now. A moment is never taken back, so a part earned on an earlier day stays.
 */
export const openedMoments = (kept: ReadonlySet<string>, onState: readonly OpeningMoment[]): Set<OpeningMoment> =>
  new Set([...OPENING_MOMENTS.filter((moment) => kept.has(moment)), ...onState]);

/** The line to show now: the first reached moment, in the table's order, whose line the account has not seen. */
export const nextLine = (opened: ReadonlySet<OpeningMoment>, seen: ReadonlySet<string>): OpeningMoment | null =>
  OPENING_MOMENTS.find((moment) => opened.has(moment) && !seen.has(moment) && moment in OPENING) ?? null;

/**
 * The account's progress as this render may read it: only the current account's counts, and only a signed-out player or
 * an account whose service has answered is known. Another account's sets, or none yet, read as an empty account that is
 * not known, so no line is told again and no earlier account's parts carry over.
 */
export function accountProgress(
  owner: string | null,
  store: {
    owner: string | null;
    status: "signed-out" | "loading" | "ready" | "error";
    reached: ReadonlySet<string>;
    seen: ReadonlySet<string>;
    onDevice: boolean;
  },
): { reached: ReadonlySet<string>; seen: ReadonlySet<string>; known: boolean; ownsParts: boolean } {
  const mine = store.owner === owner;
  return {
    reached: mine ? store.reached : new Set(),
    seen: mine ? store.seen : new Set(),
    known: owner === null || (mine && store.status === "ready"),
    // What the parts may rest on: the service's answer, or what this device kept of the account's own progress. Without
    // either, the sets are empty only because nothing is read yet, and a part earned earlier must not be taken away.
    ownsParts: owner === null || (mine && (store.status === "ready" || store.onDevice)),
  };
}

/**
 * Whether the site alert's first-entry offer is due: the Deep entered, the account's progress known, and the offer not
 * yet answered. Neither Show everything nor an unanswered explanatory line moves it.
 */
export const siteAlertOfferDue = (
  opened: ReadonlySet<OpeningMoment>,
  seen: ReadonlySet<string>,
  known: boolean,
  offer: string,
): boolean => known && opened.has("deep") && !seen.has(offer);
