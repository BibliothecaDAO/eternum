import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pageNavigation } from "@/utils/page-navigation";
import { APP_WAIT_MS, discordAndroidIntent, discordAppUrl, openDiscordSignIn } from "./discord-app";

// better-auth's address, as the identity service returns it: Discord's default prompt is better-auth's `none`.
const WEB =
  "https://discord.com/api/oauth2/authorize?scope=identify+email&response_type=code&client_id=42&redirect_uri=https%3A%2F%2Fid.test%2Fapi%2Fauth%2Fcallback%2Fdiscord&state=abc&prompt=none";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";

const on = (userAgent: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
const setVisibility = (state: DocumentVisibilityState) => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("Discord's sign-in on a phone", () => {
  let opened: ReturnType<typeof vi.spyOn>;
  // The caller's way to the same address in the browser.
  const website = vi.fn(() => pageNavigation.open(WEB));
  beforeEach(() => {
    vi.useFakeTimers();
    website.mockClear();
    opened = vi.spyOn(pageNavigation, "open").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens the app's Authorize with Discord's own query, asking it for consent, and keeps the website's as it is", () => {
    const app = new URL(discordAppUrl(WEB).replace("discord://-/", "https://app.test/"));
    expect(app.pathname).toBe("/oauth2/authorize");
    expect(Object.fromEntries(app.searchParams)).toEqual({
      ...Object.fromEntries(new URL(WEB).searchParams),
      prompt: "consent",
    });
    const intent = discordAndroidIntent(WEB);
    expect(intent).toBe(
      `intent://${discordAppUrl(WEB).slice("discord://".length)}#Intent;scheme=discord;package=com.discord;S.browser_fallback_url=${encodeURIComponent(WEB)};end`,
    );
  });

  it("hands Android the app, with the website as Chrome's fallback", () => {
    on(ANDROID);
    openDiscordSignIn(WEB, website);
    vi.advanceTimersByTime(APP_WAIT_MS);
    expect(opened.mock.calls).toEqual([[discordAndroidIntent(WEB)]]);
  });

  it("on an iPhone whose page stays in front (no app, a refused address, the system's prompt cancelled), goes on to the website", () => {
    on(IPHONE);
    openDiscordSignIn(WEB, website);
    vi.advanceTimersByTime(APP_WAIT_MS - 1);
    expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
    vi.advanceTimersByTime(1);
    expect(website).toHaveBeenCalledTimes(1);
    expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)], [WEB]]);
  });

  it("on an iPhone, leaving the page stops the website from loading by itself, also once the player is back", () => {
    on(IPHONE);
    openDiscordSignIn(WEB, website);
    setVisibility("hidden");
    setVisibility("visible");
    vi.advanceTimersByTime(APP_WAIT_MS * 4);
    expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
  });

  it("on an iPhone, the returned stop ends the wait: nothing more opens", () => {
    on(IPHONE);
    const stop = openDiscordSignIn(WEB, website);
    vi.advanceTimersByTime(APP_WAIT_MS - 1);
    stop();
    vi.advanceTimersByTime(APP_WAIT_MS);
    expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
  });
});
