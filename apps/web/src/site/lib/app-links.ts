/**
 * The one app at play.realms.party serves the games (Blitz and Eternum have their pages there; the old clients'
 * addresses redirect to it), the scroll, the terms and the privacy policy.
 */
const APP_ORIGIN = "https://play.realms.party";

export const appUrl = (path: "/blitz" | "/eternum" | "/scroll" | "/terms" | "/privacy"): string =>
  `${APP_ORIGIN}${path}`;
