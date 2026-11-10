/**
 * Where this client runs: on the web (an installed PWA included), inside the Android app on Google Play (a Trusted Web
 * Activity) or inside the iOS app on the App Store (a Capacitor shell). Both apps load the live site, so the page tells
 * them apart itself, once, at boot. Every surface that differs by app asks here; no other module reads the signs below.
 */
export type DistributionChannel = "web" | "play" | "app-store";

/** What the page shows of its launch: its user agent, its address's query, its referrer and the tab's session. */
export interface LaunchSigns {
  userAgent: string;
  search: string;
  referrer: string;
  session: Pick<Storage, "getItem" | "setItem"> | null;
}

/** The iOS shell appends this to its web view's user agent; nothing else sends it, so it wins over every other sign. */
const APP_STORE_USER_AGENT = "RealmsApp/ios";
/** The Android app launches `/?channel=play`. */
const PLAY_LAUNCH_PARAM = "channel";
const PLAY_LAUNCH_VALUE = "play";
/** A Trusted Web Activity's first page is referred by its app. */
const PLAY_REFERRER = "android-app://party.realms.play";
/** The Android app's launch, kept for the tab's session: its later pages, and a reload, carry neither sign. */
const SESSION_KEY = "realms:distribution-channel";

/** The channel these signs name: the iOS user agent first, then the Android app's launch or its session, else web. */
export const resolveDistributionChannel = (signs: LaunchSigns): DistributionChannel => {
  if (signs.userAgent.includes(APP_STORE_USER_AGENT)) return "app-store";
  if (isPlayLaunch(signs)) {
    rememberPlayLaunch(signs.session);
    return "play";
  }
  return readSession(signs.session) === PLAY_LAUNCH_VALUE ? "play" : "web";
};

const isPlayLaunch = ({ search, referrer }: LaunchSigns) =>
  new URLSearchParams(search).get(PLAY_LAUNCH_PARAM) === PLAY_LAUNCH_VALUE || referrer.startsWith(PLAY_REFERRER);

const rememberPlayLaunch = (session: LaunchSigns["session"]) => {
  try {
    session?.setItem(SESSION_KEY, PLAY_LAUNCH_VALUE);
  } catch {
    // Without session storage the launch page is still the app's; a later page reads as the web.
  }
};

const readSession = (session: LaunchSigns["session"]) => {
  try {
    return session?.getItem(SESSION_KEY) ?? null;
  } catch {
    return null;
  }
};

const readPageSigns = (): LaunchSigns => ({
  userAgent: navigator.userAgent,
  search: location.search,
  referrer: document.referrer,
  session: readSessionStorage(),
});

/** Safari refuses session storage in some private modes by throwing on access. */
const readSessionStorage = () => {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
};

let launchChannel: DistributionChannel | null = null;

/**
 * The channel this page was launched in, read once, at the first ask: main.tsx asks at boot, before the launch's address
 * can leave with a navigation.
 */
export const distributionChannel = (): DistributionChannel =>
  (launchChannel ??= resolveDistributionChannel(readPageSigns()));

/**
 * Whether a sign-in may leave for a third party: a social provider (Google, Apple, Discord, X) or a wallet (Controller,
 * Ready, Braavos). Not in the iOS app: its web view cannot run a wallet, and offering any social sign-in there needs
 * Sign in with Apple beside it (App Review Guideline 4.8), so v1 signs in with an emailed code only.
 */
export const opensThirdPartySignIn = (): boolean => distributionChannel() !== "app-store";
