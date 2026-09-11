// @vitest-environment node
import { describe, expect, it } from "vitest";
import { shouldClaimSharePoints } from "./share-points-claim-policy";

describe("shouldClaimSharePoints", () => {
  it("waits until the unregistered share is a tenth of what is registered", () => {
    expect(shouldClaimSharePoints({ registeredPoints: 1000, unregisteredPoints: 50, secondsToGameEnd: 3600 })).toBe(
      false,
    );
    expect(shouldClaimSharePoints({ registeredPoints: 1000, unregisteredPoints: 100, secondsToGameEnd: 3600 })).toBe(
      true,
    );
  });

  it("claims the first whole point when nothing is registered yet", () => {
    expect(shouldClaimSharePoints({ registeredPoints: 0, unregisteredPoints: 0.4, secondsToGameEnd: null })).toBe(
      false,
    );
    expect(shouldClaimSharePoints({ registeredPoints: 0, unregisteredPoints: 1, secondsToGameEnd: null })).toBe(true);
  });

  it("claims anything unregistered inside the endgame and nothing when there is nothing", () => {
    expect(shouldClaimSharePoints({ registeredPoints: 1000, unregisteredPoints: 2, secondsToGameEnd: 600 })).toBe(true);
    expect(shouldClaimSharePoints({ registeredPoints: 1000, unregisteredPoints: 0, secondsToGameEnd: 600 })).toBe(
      false,
    );
  });
});
