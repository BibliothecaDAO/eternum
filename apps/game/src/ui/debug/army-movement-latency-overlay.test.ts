// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isArmyMovementLatencyOverlayEnabled } from "./army-movement-latency-overlay";

describe("isArmyMovementLatencyOverlayEnabled", () => {
  it("returns false when the param is missing", () => {
    expect(isArmyMovementLatencyOverlayEnabled("")).toBe(false);
    expect(isArmyMovementLatencyOverlayEnabled("?foo=bar")).toBe(false);
  });

  it("returns true when the param is present with a truthy value", () => {
    expect(isArmyMovementLatencyOverlayEnabled("?debugMovementLatency=1")).toBe(true);
    expect(isArmyMovementLatencyOverlayEnabled("?debugMovementLatency=on")).toBe(true);
    expect(isArmyMovementLatencyOverlayEnabled("?debugMovementLatency=")).toBe(true);
  });

  it("returns false when the param is explicitly disabled", () => {
    expect(isArmyMovementLatencyOverlayEnabled("?debugMovementLatency=0")).toBe(false);
    expect(isArmyMovementLatencyOverlayEnabled("?debugMovementLatency=false")).toBe(false);
    expect(isArmyMovementLatencyOverlayEnabled("?debugMovementLatency=False")).toBe(false);
  });
});
