import { describe, expect, it } from "vitest";

import { resolveGameRouteView } from "./game-route.utils";

describe("resolveGameRouteView", () => {
  it("returns ready when setup and account are available", () => {
    expect(
      resolveGameRouteView({ phase: "ready", hasSetupResult: true, hasAccount: true, entrySource: "play-route" }),
    ).toBe("ready");
    expect(
      resolveGameRouteView({
        phase: "settlement",
        hasSetupResult: true,
        hasAccount: true,
        entrySource: "play-route",
      }),
    ).toBe("ready");
  });

  it("returns redirect when play route still needs onboarding steps", () => {
    expect(
      resolveGameRouteView({ phase: "world-select", hasSetupResult: false, hasAccount: false, entrySource: null }),
    ).toBe("redirect");
  });

  it("keeps canonical play routes loading while reconnect is still converging", () => {
    expect(
      resolveGameRouteView({ phase: "account", hasSetupResult: true, hasAccount: false, entrySource: "play-route" }),
    ).toBe("loading");
    expect(
      resolveGameRouteView({ phase: "avatar", hasSetupResult: false, hasAccount: true, entrySource: "play-route" }),
    ).toBe("loading");
  });

  it("returns reconnect for canonical play routes that have exhausted reconnect grace", () => {
    expect(
      resolveGameRouteView({
        phase: "loading",
        hasSetupResult: false,
        hasAccount: false,
        entrySource: "play-route",
        isReconnectRequired: true,
      }),
    ).toBe("reconnect");
  });

  it("returns loading while bootstrap/account are still converging", () => {
    expect(
      resolveGameRouteView({ phase: "loading", hasSetupResult: false, hasAccount: false, entrySource: "play-route" }),
    ).toBe("loading");
    expect(
      resolveGameRouteView({ phase: "loading", hasSetupResult: true, hasAccount: false, entrySource: "play-route" }),
    ).toBe("loading");
    expect(
      resolveGameRouteView({
        phase: "settlement",
        hasSetupResult: false,
        hasAccount: true,
        entrySource: "play-route",
      }),
    ).toBe("loading");
  });
});
