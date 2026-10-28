/**
 * The one app's public address, where every share card and share text sends a reader; the retired Blitz and Eternum
 * clients' addresses redirect here.
 */
export const APP_ADDRESS = "https://play.realms.party";

/** The address as a card or a post prints it. */
export const APP_HOST = new URL(APP_ADDRESS).host;

/**
 * Realms' own sites, by their domain: the game (play.realms.party), its docs, realms.world and its market. A link to
 * one of them opens as it is; a link anywhere else asks first (chat's Leaving Realms).
 */
const REALMS_DOMAINS = ["realms.party", "realms.world", "realms.market"] as const;

/** Whether an address is on one of Realms' own sites, its subdomains included. */
export const isRealmsSite = (url: URL): boolean =>
  url.protocol === "https:" &&
  REALMS_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
