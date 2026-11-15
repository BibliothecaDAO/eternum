/**
 * Shared links: a player's moment posted where their friends read (the Frontier day's card on X, an invite to their
 * Aspect), each with its own link, so the identity Worker can tell what a share brought (apps/realms/server/shares.ts).
 * The Worker, the game's share sheet and the landing the link opens read the kinds and the address from here. A link's
 * `moment` is the day a `frontier-day` link shares, or the Aspect (its id) an `aspect` link invites a friend to.
 */
export const SHARE_KINDS = ["frontier-day", "aspect"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export const isShareKind = (value: unknown): value is ShareKind =>
  typeof value === "string" && (SHARE_KINDS as readonly string[]).includes(value);

/** The game's address a shared link opens, with the link's code after it. */
export const SHARE_PATH = "/s";
export const sharePath = (code: string) => `${SHARE_PATH}/${code}`;

/**
 * Where a link was posted from: X's compose page (`x`) or the phone's own share sheet (`system`, whichever app the
 * player picked there). A link carries it as `?via=`, its landing hands it to identity with the visit, and the
 * operator's report counts visits by it.
 */
export const SHARE_CHANNELS = ["x", "system"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];
export const isShareChannel = (value: unknown): value is ShareChannel =>
  typeof value === "string" && (SHARE_CHANNELS as readonly string[]).includes(value);
/** The link as one channel posts it: its address with where it was posted from. */
export const sharePathVia = (code: string, via: ShareChannel) => `${sharePath(code)}?via=${via}`;

/**
 * A shared moment's card as the game draws it and a link unfurls it: X's and Discord's feed size (16:9), a JPEG the
 * sharer's browser makes and the identity Worker keeps, at most `bytes` of it, at `cardPath` under the game's address.
 */
export const SHARE_CARD = { width: 1200, height: 675, type: "image/jpeg", bytes: 1_000_000 } as const;
export const shareCardPath = (code: string) => `/api/shares/${code}/card`;

/** A shared link as its words name it: what it shares, and the name of the Aspect an invite names (its catalog's). */
export type SharedMoment = { kind: "frontier-day"; day: number } | { kind: "aspect"; aspect: string };

/**
 * A link's kind and moment as its words name them. The Aspect catalog lives in @bibliothecadao/types, which this
 * package does not reach: its reader hands the name in.
 */
export const sharedMomentOf = (
  link: { kind: ShareKind; moment: number },
  aspectName: (aspect: number) => string,
): SharedMoment =>
  link.kind === "aspect"
    ? { kind: "aspect", aspect: aspectName(link.moment) }
    : { kind: "frontier-day", day: link.moment };

/**
 * What a shared link says before it is opened, on its landing and in its unfurl: who shared which day, or invites a
 * friend to which Aspect, and what Frontier is. A sharer with no public name is "A player".
 */
export const SHARED_MOMENT_WORDS = {
  title: (name: string | null, moment: SharedMoment) =>
    moment.kind === "frontier-day"
      ? `${name ?? "A player"} shared Day ${moment.day} of Frontier`
      : `${name ?? "A player"} invites you to ${moment.aspect} in Frontier`,
  pitch: "A new map every day. Send your armies into the fog and bring home what they find. Your realm is free.",
} as const;
