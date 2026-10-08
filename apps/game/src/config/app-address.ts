/**
 * The one app's public address, where every share card and share text sends a reader; the retired Blitz and Eternum
 * clients' addresses redirect here.
 */
const APP_ADDRESS = "https://play.realms.party";

/** The address as a card or a post prints it. */
export const APP_HOST = new URL(APP_ADDRESS).host;
