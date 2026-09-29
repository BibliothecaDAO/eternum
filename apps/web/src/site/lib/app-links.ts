/** The one app at play.realms.party serves the scroll, the terms and the privacy policy. */
export const APP_ORIGIN = "https://play.realms.party";

export const appUrl = (path: "/scroll" | "/terms" | "/privacy"): string => `${APP_ORIGIN}${path}`;
