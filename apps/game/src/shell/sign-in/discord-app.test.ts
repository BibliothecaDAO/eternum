import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pageNavigation } from "@/utils/page-navigation";
import { APP_WAIT_MS, discordAndroidIntent, discordAppUrl, openDiscordSignIn } from "./discord-app";

// better-auth's address, as the identity service returns it.
const WEB =
  "https://discord.com/api/oauth2/authorize?scope=identify+email&response_type=code&client_id=42&redirect_uri=https%3A%2F%2Fid.test%2Fapi%2Fauth%2Fcallback%2Fdiscord&state=abc&prompt=consent";
const QUERY = new URL(WEB).search;
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";

const on = (userAgent: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
const setVisibility = (state: DocumentVisibilityState) => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("Discord's sign-in on a phone", () => {
  let opened: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    opened = vi.spyOn(pageNavigation, "open").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens the app's Authorize screen with Discord's own query", () => {
    expect(discordAppUrl(WEB)).toBe(`discord://-/oauth2/authorize${QUERY}`);
    expect(discordAndroidIntent(WEB)).toBe(
      `intent://-/oauth2/authorize${QUERY}#Intent;scheme=discord;package=com.discord;S.browser_fallback_url=${encodeURIComponent(WEB)};end`,
    );
  });

  it("stays on the website on a computer", () => {
    on(DESKTOP);
    openDiscordSignIn(WEB);
    vi.advanceTimersByTime(APP_WAIT_MS);
    expect(opened.mock.calls).toEqual([[WEB]]);
  });

  it("hands Android the app, with the website as Chrome's fallback", () => {
    on(ANDROID);
    openDiscordSignIn(WEB);
    vi.advanceTimersByTime(APP_WAIT_MS);
    expect(opened.mock.calls).toEqual([[discordAndroidIntent(WEB)]]);
  });

  it("on an iPhone, opens the app and goes no further once it took the page to the background", () => {
    on(IPHONE);
    openDiscordSignIn(WEB);
    setVisibility("hidden");
    vi.advanceTimersByTime(APP_WAIT_MS);
    expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
  });

  it("on an iPhone without the app, goes on to the website", () => {
    on(IPHONE);
    openDiscordSignIn(WEB);
    vi.advanceTimersByTime(APP_WAIT_MS - 1);
    expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)]]);
    vi.advanceTimersByTime(1);
    expect(opened.mock.calls).toEqual([[discordAppUrl(WEB)], [WEB]]);
  });
});
