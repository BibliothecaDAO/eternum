// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveLandingEntryState, resolveLandingSurfacePath } from "./landing-entry-state";

describe("landing entry state", () => {
  it("preserves the originating landing tab and mode filter for /enter routes", () => {
    expect(
      resolveLandingEntryState({
        pathname: "/enter/mainnet/aurora-blitz",
        state: {
          returnTo: "/factory",
          landingModeFilter: "season",
        },
      }),
    ).toEqual({
      activeTab: "factory",
      landingModeFilter: "season",
      returnTo: "/factory",
    });
  });

  it("falls back to the play tab and blitz mode when /enter state is missing", () => {
    expect(
      resolveLandingEntryState({
        pathname: "/enter/mainnet/aurora-blitz",
        state: null,
      }),
    ).toEqual({
      activeTab: "play",
      landingModeFilter: "blitz",
      returnTo: "/",
    });
  });

  it("maps /enter routes onto the originating landing path for shell chrome", () => {
    expect(
      resolveLandingSurfacePath({
        pathname: "/enter/mainnet/aurora-blitz",
        state: {
          returnTo: "/news?ref=hero",
        },
      }),
    ).toBe("/news");
  });

  it("leaves non-entry routes untouched", () => {
    expect(
      resolveLandingSurfacePath({
        pathname: "/markets",
        state: {
          returnTo: "/news",
          landingModeFilter: "season",
        },
      }),
    ).toBe("/markets");
  });
});
