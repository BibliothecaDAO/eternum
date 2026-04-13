import { describe, expect, it } from "vitest";

import { resolveGameRouteView } from "./game-route.utils";

describe("resolveGameRouteView", () => {
  it("returns ready when setup and account are available", () => {
    expect(resolveGameRouteView({ phase: "ready", hasSetupResult: true, hasAccount: true })).toBe("ready");
    expect(resolveGameRouteView({ phase: "handoff_scene", hasSetupResult: true, hasAccount: true })).toBe("ready");
  });

  it("returns redirect while the play route is still being normalized", () => {
    expect(resolveGameRouteView({ phase: "normalize_route", hasSetupResult: false, hasAccount: false })).toBe(
      "redirect",
    );
  });

  it("keeps canonical play routes loading while reconnect is still converging", () => {
    expect(resolveGameRouteView({ phase: "await_account", hasSetupResult: true, hasAccount: false })).toBe("loading");
    expect(resolveGameRouteView({ phase: "select_world", hasSetupResult: false, hasAccount: true })).toBe("loading");
  });

  it("returns reconnect for canonical play routes that have exhausted reconnect grace", () => {
    expect(
      resolveGameRouteView({
        phase: "reconnect_required",
        hasSetupResult: false,
        hasAccount: false,
        isReconnectRequired: true,
      }),
    ).toBe("reconnect");
  });

  it("returns loading while bootstrap/account are still converging", () => {
    expect(resolveGameRouteView({ phase: "setup_dojo", hasSetupResult: false, hasAccount: false })).toBe("loading");
    expect(resolveGameRouteView({ phase: "setup_dojo", hasSetupResult: true, hasAccount: false })).toBe("loading");
    expect(resolveGameRouteView({ phase: "wait_worldmap_ready", hasSetupResult: false, hasAccount: true })).toBe(
      "loading",
    );
  });
});
