/**
 * The app a run plays the client in, launched as that app launches the live site (src/runtime/distribution-channel.ts
 * reads the same signs): the web as is; the Android app's Trusted Web Activity opens `?channel=play`; the iOS app's web
 * view appends `RealmsApp/ios` to its user agent.
 */
export const CHANNELS = ["web", "play", "app-store"];

const APP_STORE_USER_AGENT = "RealmsApp/ios";

/** The run's first page, with the Android app's launch mark where it plays that app. */
export function launchUrlIn(channel, url) {
  if (channel !== "play") return url;
  const launch = new URL(url);
  launch.searchParams.set("channel", "play");
  return launch.toString();
}

/**
 * The iOS app's user agent on the run's page, set before it opens anything: the browser's own with the shell's mark
 * after it, held while `devTools` stays open.
 */
export async function presentAsChannel(devTools, channel) {
  if (channel !== "app-store") return;
  const { userAgent } = await devTools.sendToBrowser("Browser.getVersion");
  await devTools.send("Emulation.setUserAgentOverride", { userAgent: `${userAgent} ${APP_STORE_USER_AGENT}` });
}

/** Read once the client booted: the page an App Store run plays must carry the shell's mark and no service worker. */
export const APP_STORE_PAGE_EXPRESSION = `navigator.serviceWorker?.getRegistration("/")
  .then((worker) => ({ userAgent: navigator.userAgent, serviceWorker: Boolean(worker) }))
  ?? { userAgent: navigator.userAgent, serviceWorker: false }`;

/** Why the booted page is not the iOS app's, or null when it is. */
export function appStorePageProblem({ userAgent, serviceWorker }) {
  if (!userAgent.includes(APP_STORE_USER_AGENT)) return `the page's user agent lacks ${APP_STORE_USER_AGENT}`;
  if (serviceWorker) return "the iOS app's page registered a service worker";
  return null;
}
