import { isAppleMobile } from "@/pwa/browser-capabilities";
import { pageNavigation } from "@/utils/page-navigation";

/**
 * Discord's sign-in, opened in the Discord app on a phone that has it, where the player is already signed in to
 * Discord: one tap on Authorize instead of a password and a code in the browser. The website is the way when there is
 * no app, on the player's choice, and on a computer, which loads it as a page.
 *
 * - The app's own address for a discord.com page is `discord://-/<path>`; its Authorize screen takes the same query.
 *   The https address cannot do it: on an iPhone Discord's apple-app-site-association refuses `/oauth2/authorize` with
 *   a `response_type` as a universal link, so it always stays in the browser.
 * - Only the app's address asks for consent: better-auth's `prompt=none` hangs the Discord iPhone app's Authorize
 *   (discord/discord-api-docs#6160). The website keeps the identity service's address as it is, so a computer and the
 *   website fallback sign in as they always have.
 * - Android's Chrome opens an `intent:` for the app, or its `browser_fallback_url` without it.
 * - An iPhone has no fallback for an app it lacks, so the website follows after `APP_WAIT_MS` while the page stays in
 *   front. A page that went to the background may have opened the app or may only have been switched away from: it
 *   cannot tell, so it stops there and the player chooses on the Discord step (the app again, the browser, or the code).
 *
 * The app sends Discord's answer to a browser, often not this one: discord-handoff.ts shows a code there.
 */
export const APP_WAIT_MS = 2500;

/** Whether Discord's sign-in goes to the app here: a phone with an app to hand it to. */
export const opensDiscordApp = () => isAndroid() || isAppleMobile();

const isAndroid = () => /Android/i.test(navigator.userAgent);

const appPath = (web: string) => {
  const query = new URL(web).searchParams;
  query.set("prompt", "consent");
  return `-/oauth2/authorize?${query}`;
};

export const discordAppUrl = (web: string) => `discord://${appPath(web)}`;

export const discordAndroidIntent = (web: string) =>
  `intent://${appPath(web)}#Intent;scheme=discord;package=com.discord;S.browser_fallback_url=${encodeURIComponent(web)};end`;

/**
 * Opens Discord's sign-in at `web`, the identity service's authorize address, in a phone's app (`opensDiscordApp`).
 * Returns what stops the rest of it (an iPhone's website fallback still to come). It must run inside the player's tap:
 * a browser hands a page to another app only from a tap.
 */
export const openDiscordSignIn = (web: string): (() => void) => {
  if (isAndroid()) {
    pageNavigation.open(discordAndroidIntent(web));
    return () => {};
  }
  return openAppThenWebsite(web);
};

const openAppThenWebsite = (web: string) => {
  const stop = () => {
    window.clearTimeout(fallback);
    document.removeEventListener("visibilitychange", away);
    window.removeEventListener("pagehide", stop);
  };
  const away = () => {
    if (document.visibilityState === "hidden") stop();
  };
  const fallback = window.setTimeout(() => {
    stop();
    pageNavigation.open(web);
  }, APP_WAIT_MS);
  document.addEventListener("visibilitychange", away);
  window.addEventListener("pagehide", stop);
  pageNavigation.open(discordAppUrl(web));
  return stop;
};
