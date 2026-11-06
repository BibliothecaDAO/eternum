import { isAppleMobile } from "@/pwa/browser-capabilities";
import { pageNavigation } from "@/utils/page-navigation";

/**
 * Discord's sign-in, opened in the Discord app on a phone that has it, where the player is already signed in to
 * Discord: one tap on Authorize instead of a password and a code in the browser. The website is the way when there is
 * no app, and on a computer.
 *
 * - The app's own address for a discord.com page is `discord://-/<path>`; its Authorize screen takes the same query.
 *   The https address cannot do it: on an iPhone Discord's apple-app-site-association refuses `/oauth2/authorize` with
 *   a `response_type` as a universal link, so it always stays in the browser.
 * - Android's Chrome opens an `intent:` for the app, or its `browser_fallback_url` without it.
 * - An iPhone has no fallback for an app it lacks, so the website follows unless the page went to the background (the
 *   app opened) within `APP_WAIT_MS`.
 *
 * The app sends Discord's answer to a browser, often not this one: discord-handoff.ts shows a code there.
 */
export const APP_WAIT_MS = 2500;

const appPath = (web: string) => `-/oauth2/authorize${new URL(web).search}`;

export const discordAppUrl = (web: string) => `discord://${appPath(web)}`;

export const discordAndroidIntent = (web: string) =>
  `intent://${appPath(web)}#Intent;scheme=discord;package=com.discord;S.browser_fallback_url=${encodeURIComponent(web)};end`;

export const openDiscordSignIn = (web: string) => {
  if (/Android/i.test(navigator.userAgent)) return pageNavigation.open(discordAndroidIntent(web));
  if (!isAppleMobile()) return pageNavigation.open(web);
  let appOpened = false;
  const left = () => (appOpened = true);
  const hidden = () => document.visibilityState === "hidden" && left();
  document.addEventListener("visibilitychange", hidden);
  window.addEventListener("pagehide", left);
  pageNavigation.open(discordAppUrl(web));
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", hidden);
    window.removeEventListener("pagehide", left);
    if (!appOpened) pageNavigation.open(web);
  }, APP_WAIT_MS);
};
