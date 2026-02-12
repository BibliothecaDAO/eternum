import { describe, expect, it } from "vitest";

import { resolveGameRouteView } from "./game-route.utils";

describe("resolveGameRouteView", () => {
  it("returns ready when setup and account are available", () => {
    expect(resolveGameRouteView({ phase: "ready", hasSetupResult: true, hasAccount: true })).toBe("ready");
    expect(resolveGameRouteView({ phase: "settlement", hasSetupResult: true, hasAccount: true })).toBe("ready");
  });

  it("returns redirect when play route still needs onboarding steps", () => {
    expect(resolveGameRouteView({ phase: "world-select", hasSetupResult: false, hasAccount: false })).toBe("redirect");
    expect(resolveGameRouteView({ phase: "account", hasSetupResult: true, hasAccount: false })).toBe("redirect");
    expect(resolveGameRouteView({ phase: "avatar", hasSetupResult: false, hasAccount: true })).toBe("redirect");
  });

  it("returns loading while bootstrap/account are still converging", () => {
    expect(resolveGameRouteView({ phase: "loading", hasSetupResult: false, hasAccount: false })).toBe("loading");
    expect(resolveGameRouteView({ phase: "loading", hasSetupResult: true, hasAccount: false })).toBe("loading");
    expect(resolveGameRouteView({ phase: "settlement", hasSetupResult: false, hasAccount: true })).toBe("loading");
  });
});
