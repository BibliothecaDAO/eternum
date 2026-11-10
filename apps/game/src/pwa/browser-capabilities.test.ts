import { afterEach, describe, expect, it, vi } from "vitest";

/** The app the client runs in; the web unless a test says otherwise. */
const app = vi.hoisted(() => ({ channel: "web" as "web" | "play" | "app-store" }));
vi.mock("@/runtime/distribution-channel", () => ({ distributionChannel: () => app.channel }));

import { isInstalledApp, runsServiceWorker } from "./browser-capabilities";
import { localNotificationCapability } from "./local-notification-client";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";

/** A phone's browser tab, not installed, with the worker API, notifications and a secure page. */
const phoneBrowser = (userAgent: string) => {
  vi.stubGlobal("navigator", { userAgent, platform: "iPhone", maxTouchPoints: 5, serviceWorker: {} });
  vi.stubGlobal("Notification", { permission: "default" });
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
};

afterEach(() => {
  vi.unstubAllGlobals();
  app.channel = "web";
});

describe("browser capabilities by channel", () => {
  it("counts either store app as installed, and a browser tab only once installed itself", () => {
    phoneBrowser(IPHONE);
    expect(isInstalledApp()).toBe(false);
    app.channel = "play";
    expect(isInstalledApp()).toBe(true);
    app.channel = "app-store";
    expect(isInstalledApp()).toBe(true);
  });

  it("runs the service worker on the web and in the Play app, never in the iOS app", () => {
    phoneBrowser(IPHONE);
    expect(runsServiceWorker()).toBe(true);
    app.channel = "play";
    expect(runsServiceWorker()).toBe(true);
    app.channel = "app-store";
    expect(runsServiceWorker()).toBe(false);
  });

  it("asks an iPhone's browser to install for alerts, but never the iOS app, whose alerts are not the worker's", () => {
    phoneBrowser(IPHONE);
    expect(localNotificationCapability()).toBe("Install the game to your Home Screen.");
    app.channel = "app-store";
    expect(localNotificationCapability()).toBe("Device notifications are unavailable in this browser.");
  });
});
