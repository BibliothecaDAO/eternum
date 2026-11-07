/**
 * Shared links: a player's moment posted where their friends read (the Frontier day's card on X), each with its own
 * link, so the identity Worker can tell what a share brought (apps/realms/server/shares.ts). The Worker, the game's
 * share sheet and the landing the link opens read the kinds and the address from here.
 */
export const SHARE_KINDS = ["frontier-day"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export const isShareKind = (value: unknown): value is ShareKind =>
  typeof value === "string" && (SHARE_KINDS as readonly string[]).includes(value);

/** The game's address a shared link opens, with the link's code after it. */
export const SHARE_PATH = "/s";
export const sharePath = (code: string) => `${SHARE_PATH}/${code}`;

/**
 * How long after it joined a friend a share brought may still count as activated (founded a realm on the link's
 * season board and cleared a site there): a join that takes longer is the share's, but not its activation.
 */
export const SHARE_ACTIVATION_DAYS = 14;
