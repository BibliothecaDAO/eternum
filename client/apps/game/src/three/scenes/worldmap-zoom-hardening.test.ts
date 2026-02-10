import { describe, expect, it } from "vitest";
import { createWorldmapZoomHardeningConfig } from "./worldmap-zoom-hardening";

describe("createWorldmapZoomHardeningConfig", () => {
  it("disables all hardening behavior when master flag is off", () => {
    const config = createWorldmapZoomHardeningConfig({
      enabled: false,
      telemetry: true,
    });

    expect(config.enabled).toBe(false);
    expect(config.latestWinsRefresh).toBe(false);
    expect(config.terrainSelfHeal).toBe(false);
    expect(config.telemetry).toBe(false);
  });

  it("enables hardening behavior without telemetry by default", () => {
    const config = createWorldmapZoomHardeningConfig({
      enabled: true,
      telemetry: false,
    });

    expect(config.enabled).toBe(true);
    expect(config.latestWinsRefresh).toBe(true);
    expect(config.terrainSelfHeal).toBe(true);
    expect(config.telemetry).toBe(false);
  });

  it("enables telemetry only when hardening is enabled", () => {
    const config = createWorldmapZoomHardeningConfig({
      enabled: true,
      telemetry: true,
    });

    expect(config.enabled).toBe(true);
    expect(config.latestWinsRefresh).toBe(true);
    expect(config.terrainSelfHeal).toBe(true);
    expect(config.telemetry).toBe(true);
  });
});
