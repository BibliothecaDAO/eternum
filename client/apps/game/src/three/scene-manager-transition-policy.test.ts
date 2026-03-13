import { describe, expect, it } from "vitest";
import { SceneName } from "./types";
import {
  resolvePendingTransitionStart,
  resolveSceneSwitchRequest,
  resolveTransitionFinalizePlan,
} from "./scene-manager-transition-policy";

describe("resolveSceneSwitchRequest", () => {
  it("ignores requests for scenes that are not registered", () => {
    expect(
      resolveSceneSwitchRequest({
        requestedSceneName: SceneName.WorldMap,
        hasRequestedScene: false,
        transitionRequestToken: 3,
        transitionInProgress: true,
        pendingSceneName: SceneName.Hexception,
      }),
    ).toEqual({
      shouldStartPendingTransition: false,
      nextTransitionRequestToken: 3,
      nextPendingSceneName: SceneName.Hexception,
    });
  });

  it("queues and starts transition when no transition is in progress", () => {
    expect(
      resolveSceneSwitchRequest({
        requestedSceneName: SceneName.WorldMap,
        hasRequestedScene: true,
        transitionRequestToken: 5,
        transitionInProgress: false,
        pendingSceneName: undefined,
      }),
    ).toEqual({
      shouldStartPendingTransition: true,
      nextTransitionRequestToken: 6,
      nextPendingSceneName: SceneName.WorldMap,
    });
  });

  it("queues latest request without starting when transition is already in progress", () => {
    expect(
      resolveSceneSwitchRequest({
        requestedSceneName: SceneName.Hexception,
        hasRequestedScene: true,
        transitionRequestToken: 8,
        transitionInProgress: true,
        pendingSceneName: SceneName.WorldMap,
      }),
    ).toEqual({
      shouldStartPendingTransition: false,
      nextTransitionRequestToken: 9,
      nextPendingSceneName: SceneName.Hexception,
    });
  });
});

describe("resolvePendingTransitionStart", () => {
  it("does nothing when there is no pending scene", () => {
    expect(
      resolvePendingTransitionStart({
        pendingSceneName: undefined,
        hasPendingScene: false,
        transitionRequestToken: 1,
      }),
    ).toEqual({
      shouldStartTransition: false,
      sceneNameToTransition: undefined,
      transitionToken: undefined,
      nextPendingSceneName: undefined,
    });
  });

  it("clears stale pending scene names that are no longer registered", () => {
    expect(
      resolvePendingTransitionStart({
        pendingSceneName: SceneName.WorldMap,
        hasPendingScene: false,
        transitionRequestToken: 2,
      }),
    ).toEqual({
      shouldStartTransition: false,
      sceneNameToTransition: undefined,
      transitionToken: undefined,
      nextPendingSceneName: undefined,
    });
  });

  it("consumes pending scene and starts transition for the active request token", () => {
    expect(
      resolvePendingTransitionStart({
        pendingSceneName: SceneName.Hexception,
        hasPendingScene: true,
        transitionRequestToken: 7,
      }),
    ).toEqual({
      shouldStartTransition: true,
      sceneNameToTransition: SceneName.Hexception,
      transitionToken: 7,
      nextPendingSceneName: undefined,
    });
  });
});

describe("resolveTransitionFinalizePlan", () => {
  it("skips post-setup effects for superseded transitions but still chains pending transitions", () => {
    expect(
      resolveTransitionFinalizePlan({
        transitionToken: 4,
        latestTransitionRequestToken: 5,
        hasPendingScene: true,
      }),
    ).toEqual({
      isSuperseded: true,
      shouldRunPostSetupEffects: false,
      shouldStartPendingTransition: true,
    });
  });

  it("runs post-setup effects for authoritative transitions", () => {
    expect(
      resolveTransitionFinalizePlan({
        transitionToken: 6,
        latestTransitionRequestToken: 6,
        hasPendingScene: false,
      }),
    ).toEqual({
      isSuperseded: false,
      shouldRunPostSetupEffects: true,
      shouldStartPendingTransition: false,
    });
  });
});
