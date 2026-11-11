import { afterEach, expect, it, vi } from "vitest";

/** The app the client runs in; the web unless a test says otherwise. */
const app = vi.hoisted(() => ({ channel: "web" as "web" | "play" | "app-store" }));
vi.mock("@/runtime/distribution-channel", () => ({ distributionChannel: () => app.channel }));

import { iosAppBridge } from "./ios-app-bridge";

/** Capacitor's bridge as the iOS app injects it into the page. */
const nativeBridge = { isNativePlatform: () => true, nativePromise: async () => ({}), addListener: () => ({}) };
const inject = (bridge: unknown) => ((window as { Capacitor?: unknown }).Capacitor = bridge);

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
  app.channel = "web";
});

it("is the iOS app's bridge there", () => {
  app.channel = "app-store";
  inject(nativeBridge);
  expect(iosAppBridge()).toBe(nativeBridge);
});

it.each(["web", "play"] as const)("is none on the %s channel, even where a page carries a native bridge", (channel) => {
  app.channel = channel;
  expect(iosAppBridge()).toBeNull();
  inject(nativeBridge);
  expect(iosAppBridge()).toBeNull();
});

it("is none in the iOS app before Capacitor's bridge is native, or without one", () => {
  app.channel = "app-store";
  expect(iosAppBridge()).toBeNull();
  inject({ isNativePlatform: () => false });
  expect(iosAppBridge()).toBeNull();
});
