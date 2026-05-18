// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/three/scenes/worldmap.tsx"), "utf8");

describe("worldmap setup-timeout toast policy wiring", () => {
  it("imports the toast policy helper", () => {
    expect(source).toContain("shouldShowSetupTimeoutToast");
  });

  it("uses the policy inside handleToriiSubscriptionSetupTimeout", () => {
    const start = source.indexOf("private handleToriiSubscriptionSetupTimeout");
    const end = source.indexOf("private invalidate", start);
    expect(start).toBeGreaterThan(-1);
    const methodSource = source.slice(start, end > start ? end : start + 4000);
    expect(methodSource).toContain("shouldShowSetupTimeoutToast");
    expect(methodSource).toContain("lastSetupTimeoutToastReconnectAttempt");
  });

  it("retains the throttle constant for the policy", () => {
    expect(source).toContain("SETUP_TIMEOUT_TOAST_THROTTLE_MS");
  });
});
