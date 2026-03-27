// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveViewTransitionGuardDecision } from "./navigation-view-transition-guard";

describe("resolveViewTransitionGuardDecision", () => {
  it("arms cooldown for map-to-hex transitions", () => {
    const decision = resolveViewTransitionGuardDecision({
      nowMs: 1_000,
      guardUntilMs: 0,
      fromScene: "map",
      toScene: "hex",
      cooldownMs: 500,
      isTransitionInFlight: false,
    });

    expect(decision).toEqual({
      shouldBlockTransition: false,
      nextGuardUntilMs: 1_500,
    });
  });

  it("blocks world/local transitions while guard is active", () => {
    const decision = resolveViewTransitionGuardDecision({
      nowMs: 1_200,
      guardUntilMs: 1_500,
      fromScene: "map",
      toScene: "hex",
      cooldownMs: 500,
      isTransitionInFlight: false,
    });

    expect(decision).toEqual({
      shouldBlockTransition: true,
      nextGuardUntilMs: 1_500,
    });
  });

  it("does not arm guard for same-scene world navigation when no guard is active", () => {
    const decision = resolveViewTransitionGuardDecision({
      nowMs: 1_000,
      guardUntilMs: 0,
      fromScene: "map",
      toScene: "map",
      cooldownMs: 500,
      isTransitionInFlight: false,
    });

    expect(decision).toEqual({
      shouldBlockTransition: false,
      nextGuardUntilMs: 0,
    });
  });

  it("blocks same-scene world navigation while guard is active", () => {
    const decision = resolveViewTransitionGuardDecision({
      nowMs: 1_200,
      guardUntilMs: 1_500,
      fromScene: "map",
      toScene: "map",
      cooldownMs: 500,
      isTransitionInFlight: false,
    });

    expect(decision).toEqual({
      shouldBlockTransition: true,
      nextGuardUntilMs: 1_500,
    });
  });

  it("blocks world/local navigation while a transition is in flight", () => {
    const decision = resolveViewTransitionGuardDecision({
      nowMs: 1_000,
      guardUntilMs: 0,
      fromScene: "map",
      toScene: "hex",
      cooldownMs: 500,
      isTransitionInFlight: true,
    });

    expect(decision).toEqual({
      shouldBlockTransition: true,
      nextGuardUntilMs: 0,
    });
  });
});
