import { describe, expect, it } from "vitest";

import { doorwayView } from "./doorway-view";

const track = (view: ReturnType<typeof doorwayView>) =>
  view.steps.map(({ step, state }) => `${step}:${state}`).join(" ");

describe("the doorway", () => {
  it("walks a player from the account through founding the realm on the entry side", () => {
    const entry = (phase: Parameters<typeof doorwayView>[0]["phase"]) =>
      doorwayView({ source: "entry", phase: phase as never, audience: "player", signedIn: true });
    expect(track(entry("loading"))).toBe("account:running realm:waiting map:waiting play:waiting");
    expect(track(entry("settlement"))).toBe("account:done realm:running map:waiting play:waiting");
    expect(track(entry("settlement-waiting"))).toBe("account:done realm:running map:waiting play:waiting");
    expect(track(entry("ready"))).toBe("account:done realm:done map:running play:waiting");
  });

  it("carries on across the navigation on the game's side, the map booting and then play", () => {
    const boot = (phase: Parameters<typeof doorwayView>[0]["phase"]) =>
      doorwayView({ source: "boot", phase: phase as never, audience: "player" });
    expect(track(boot("await_account"))).toBe("account:running realm:waiting map:waiting play:waiting");
    for (const phase of ["select_world", "setup_game", "initial_sync", "seed_entry_state", "init_renderer"] as const) {
      expect(track(boot(phase))).toBe("account:done realm:done map:running play:waiting");
    }
    expect(track(boot("wait_worldmap_ready"))).toBe("account:done realm:done map:running play:waiting");
    expect(track(boot("handoff_scene"))).toBe("account:done realm:done map:done play:running");
    expect(track(boot("ready"))).toBe("account:done realm:done map:done play:done");
    expect(boot("ready").blocker).toBeNull();
  });

  it("walks a spectator only through the map and play", () => {
    expect(track(doorwayView({ source: "entry", phase: "loading", audience: "spectator", signedIn: false }))).toBe(
      "map:running play:waiting",
    );
    expect(track(doorwayView({ source: "boot", phase: "await_account", audience: "spectator" }))).toBe(
      "map:running play:waiting",
    );
    expect(track(doorwayView({ source: "boot", phase: "handoff_scene", audience: "spectator" }))).toBe(
      "map:done play:running",
    );
  });

  it("holds for a sign-in, or for a calm retry when the world or its scene did not open", () => {
    expect(doorwayView({ source: "entry", phase: "account", audience: "player", signedIn: false }).blocker).toEqual({
      action: "sign-in",
      sentence: "Sign in to play.",
    });
    expect(doorwayView({ source: "entry", phase: "account", audience: "player", signedIn: true }).blocker).toBeNull();
    expect(doorwayView({ source: "boot", phase: "reconnect_required", audience: "player" }).blocker?.action).toBe(
      "sign-in",
    );
    const unset = "Your account could not be set up for this game. Try again in a moment.";
    expect(
      doorwayView({ source: "boot", phase: "reconnect_required", audience: "player", accountError: unset }).blocker,
    ).toEqual({ action: "retry", sentence: unset });
    // A failed scene or board ends the boot in its error state: the doorway shows Retry, never an endless track.
    const failed = doorwayView({ source: "boot", phase: "error", audience: "player" });
    expect(failed.blocker).toEqual({ action: "retry", sentence: "The world did not open. Try again." });
    expect(doorwayView({ source: "entry", phase: "error", audience: "player", signedIn: true }).blocker?.action).toBe(
      "retry",
    );
  });

  it("holds on the realm step with a retry when founding the realm failed", () => {
    const view = doorwayView({
      source: "entry",
      phase: "settlement",
      audience: "player",
      signedIn: true,
      foundingFailed: true,
    });
    expect(track(view)).toBe("account:done realm:running map:waiting play:waiting");
    expect(view.blocker).toEqual({ action: "retry", sentence: "Your realm was not founded. Try again." });
  });

  it("offers watching when a Blitz has no seat for the player", () => {
    expect(
      doorwayView({ source: "entry", phase: "spectate", audience: "player", signedIn: true }).offersSpectating,
    ).toBe(true);
  });
});
