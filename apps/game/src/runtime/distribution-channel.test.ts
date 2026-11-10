import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveDistributionChannel, type LaunchSigns } from "./distribution-channel";

const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36";

/** One browser tab: its session storage outlives a reload, not a new launch. */
const tab = () => {
  const stored = new Map<string, string>();
  return {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
  };
};

const page = (signs: Partial<LaunchSigns>): LaunchSigns => ({
  userAgent: CHROME_ANDROID,
  search: "",
  referrer: "",
  session: tab(),
  ...signs,
});

describe("resolveDistributionChannel", () => {
  it("reads a browser with no app's sign as the web", () => {
    expect(resolveDistributionChannel(page({}))).toBe("web");
    expect(resolveDistributionChannel(page({ userAgent: SAFARI, search: "?channel=web" }))).toBe("web");
    expect(resolveDistributionChannel(page({ referrer: "https://play.realms.party/" }))).toBe("web");
  });

  it("reads the iOS shell's user agent as the App Store app", () => {
    expect(resolveDistributionChannel(page({ userAgent: `${SAFARI} RealmsApp/ios` }))).toBe("app-store");
  });

  it("reads the Android app's launch, by its address or its referrer, as the Play app", () => {
    expect(resolveDistributionChannel(page({ search: "?channel=play" }))).toBe("play");
    expect(resolveDistributionChannel(page({ search: "?rendererMode=webgpu-auto&channel=play" }))).toBe("play");
    expect(resolveDistributionChannel(page({ referrer: "android-app://party.realms.play/" }))).toBe("play");
  });

  it("puts the iOS user agent before any Android sign", () => {
    const session = tab();
    resolveDistributionChannel(page({ search: "?channel=play", session }));
    expect(
      resolveDistributionChannel(
        page({
          userAgent: `${SAFARI} RealmsApp/ios`,
          search: "?channel=play",
          referrer: "android-app://party.realms.play/",
          session,
        }),
      ),
    ).toBe("app-store");
  });

  it("keeps the Android app's launch for the session: a later page or a reload carries no sign", () => {
    const session = tab();
    expect(resolveDistributionChannel(page({ search: "?channel=play", session }))).toBe("play");
    expect(resolveDistributionChannel(page({ session }))).toBe("play");
    expect(resolveDistributionChannel(page({ search: "?spectate=true", session }))).toBe("play");
  });

  it("reads a cold relaunch from its own launch, never from an earlier session", () => {
    // The app's relaunch opens its start address again, in a new session.
    expect(resolveDistributionChannel(page({ search: "?channel=play", session: tab() }))).toBe("play");
    expect(resolveDistributionChannel(page({ referrer: "android-app://party.realms.play/", session: tab() }))).toBe(
      "play",
    );
    // The same phone's browser, in its own session, is the web.
    expect(resolveDistributionChannel(page({ session: tab() }))).toBe("web");
    // The iOS shell says so on every launch.
    expect(resolveDistributionChannel(page({ userAgent: `${SAFARI} RealmsApp/ios`, session: tab() }))).toBe(
      "app-store",
    );
  });

  it("still reads the launch page where session storage is refused", () => {
    const refusing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(resolveDistributionChannel(page({ search: "?channel=play", session: refusing }))).toBe("play");
    expect(resolveDistributionChannel(page({ session: refusing }))).toBe("web");
    expect(resolveDistributionChannel(page({ search: "?channel=play", session: null }))).toBe("play");
  });
});

describe("the page's channel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    window.history.replaceState(null, "", "/");
    sessionStorage.clear();
  });

  /** The module as a page boots it, from the page's own signs. */
  const boot = async (userAgent: string, path = "/") => {
    vi.resetModules();
    vi.stubGlobal("navigator", { userAgent });
    window.history.replaceState(null, "", path);
    return import("./distribution-channel");
  };

  it("is read once, at boot: the launch's address leaving later changes nothing", async () => {
    const page = await boot(CHROME_ANDROID, "/?channel=play");
    expect(page.distributionChannel()).toBe("play");
    window.history.replaceState(null, "", "/play");
    sessionStorage.clear();
    expect(page.distributionChannel()).toBe("play");
  });

  it("opens third-party sign-in (a social provider, a wallet) everywhere but the iOS app", async () => {
    expect((await boot(CHROME_ANDROID)).opensThirdPartySignIn()).toBe(true);
    expect((await boot(CHROME_ANDROID, "/?channel=play")).opensThirdPartySignIn()).toBe(true);
    const ios = await boot(`${SAFARI} RealmsApp/ios`);
    expect(ios.distributionChannel()).toBe("app-store");
    expect(ios.opensThirdPartySignIn()).toBe(false);
  });
});
