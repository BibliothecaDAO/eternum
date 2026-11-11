// @vitest-environment node
import { expect, it } from "vitest";

import { appStorePageProblem, launchUrlIn, presentAsChannel } from "./channel.mjs";

const CHROME =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0 Safari/537.36";

/** A DevTools connection that records what was sent to the page and answers the browser's version. */
const fakeDevTools = () => {
  const sent = [];
  return {
    sent,
    send: async (method, params) => void sent.push({ method, params }),
    sendToBrowser: async (method) => (method === "Browser.getVersion" ? { userAgent: CHROME } : {}),
  };
};

it("marks only the Android app's launch on the run's first page", () => {
  const page = "https://127.0.0.1:4173/?rendererMode=webgpu-auto&dev=0";
  expect(new URL(launchUrlIn("play", page)).searchParams.get("channel")).toBe("play");
  expect(new URL(launchUrlIn("play", page)).searchParams.get("rendererMode")).toBe("webgpu-auto");
  expect(launchUrlIn("web", page)).toBe(page);
  expect(launchUrlIn("app-store", page)).toBe(page);
});

it("appends the iOS shell's mark to the browser's own user agent, and leaves other channels' alone", async () => {
  const ios = fakeDevTools();
  await presentAsChannel(ios, "app-store");
  expect(ios.sent).toEqual([
    { method: "Emulation.setUserAgentOverride", params: { userAgent: `${CHROME} RealmsApp/ios` } },
  ]);
  for (const channel of ["web", "play"]) {
    const other = fakeDevTools();
    await presentAsChannel(other, channel);
    expect(other.sent).toEqual([]);
  }
});

it("refuses an App Store page without the shell's mark or with a service worker", () => {
  expect(appStorePageProblem({ userAgent: `${CHROME} RealmsApp/ios`, serviceWorker: false })).toBeNull();
  expect(appStorePageProblem({ userAgent: CHROME, serviceWorker: false })).toBe(
    "the page's user agent lacks RealmsApp/ios",
  );
  expect(appStorePageProblem({ userAgent: `${CHROME} RealmsApp/ios`, serviceWorker: true })).toBe(
    "the iOS app's page registered a service worker",
  );
});
