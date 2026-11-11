import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The app the client runs in; the web unless a test says otherwise. */
const app = vi.hoisted(() => ({ channel: "web" as "web" | "play" | "app-store" }));
vi.mock("@/runtime/distribution-channel", () => ({ distributionChannel: () => app.channel }));

import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { canPlayHaptics, playActionConfirmedHaptic, playHaptic } from "./motion-settings";

type Channel = typeof app.channel;

/** The iOS app's Haptics plugin as its page meets it, through Capacitor's bridge: each call it is handed. */
const installAppBridge = (answer: () => Promise<unknown> = async () => undefined) => {
  const calls: { plugin: string; method: string; options?: object }[] = [];
  (window as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    nativePromise: (plugin: string, method: string, options?: object) => {
      calls.push({ plugin, method, options });
      return answer();
    },
    addListener: () => ({ remove: async () => {} }),
  };
  return calls;
};

/** A phone's browser: a touch-first screen and, unless said otherwise, the vibration API (Android's, not iOS's). */
const phoneBrowser = ({ vibrates }: { vibrates: boolean }) => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(pointer: coarse)" }));
  const vibrate = vi.fn(() => true);
  if (vibrates) vi.stubGlobal("navigator", { ...navigator, vibrate });
  return vibrate;
};

beforeEach(() => useWorldAppearanceStore.setState({ haptics: true }));
afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
  vi.unstubAllGlobals();
  app.channel = "web";
});

describe("a confirmed action's haptic", () => {
  it("is one light impact in the iOS app", () => {
    app.channel = "app-store";
    const calls = installAppBridge();
    playActionConfirmedHaptic();
    expect(calls).toEqual([{ plugin: "Haptics", method: "impact", options: { style: "LIGHT" } }]);
  });

  it("is none in the iOS app with Haptics off in Settings", () => {
    app.channel = "app-store";
    const calls = installAppBridge();
    useWorldAppearanceStore.setState({ haptics: false });
    playActionConfirmedHaptic();
    expect(calls).toEqual([]);
  });

  it("stays silent in an app build without the plugin, which refuses the call", async () => {
    app.channel = "app-store";
    const refused = vi.fn();
    process.on("unhandledRejection", refused);
    const calls = installAppBridge(() => Promise.reject(new Error("Haptics plugin is not implemented on ios")));
    playActionConfirmedHaptic();
    await new Promise((settle) => setTimeout(settle, 0));
    process.off("unhandledRejection", refused);
    expect(calls).toHaveLength(1);
    expect(refused).not.toHaveBeenCalled();
  });

  it.each<Channel>(["web", "play"])("is none on the %s channel: no plugin call and no vibration", (channel) => {
    app.channel = channel;
    const calls = installAppBridge();
    const vibrate = phoneBrowser({ vibrates: true });
    playActionConfirmedHaptic();
    expect(calls).toEqual([]);
    expect(vibrate).not.toHaveBeenCalled();
  });
});

describe("Settings' Haptics row", () => {
  it("shows in the iOS app, which has no vibration API but its plugin", () => {
    app.channel = "app-store";
    phoneBrowser({ vibrates: false });
    installAppBridge();
    expect(canPlayHaptics()).toBe(true);
  });

  it.each<Channel>(["web", "play"])("shows on the %s channel only where the phone vibrates", (channel) => {
    app.channel = channel;
    phoneBrowser({ vibrates: false });
    expect(canPlayHaptics()).toBe(false);
    phoneBrowser({ vibrates: true });
    expect(canPlayHaptics()).toBe(true);
  });
});

describe("a moment's haptic", () => {
  it("still vibrates an Android phone with Haptics on, as before", () => {
    app.channel = "play";
    const vibrate = phoneBrowser({ vibrates: true });
    playHaptic(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });
});
