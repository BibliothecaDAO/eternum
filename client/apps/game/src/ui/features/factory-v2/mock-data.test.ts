import { describe, expect, it } from "vitest";

import { getFactoryEnvironmentOptions, getFactoryLaunchPresetsForMode, getPresetStartAtValue } from "./catalog";
import { factoryRuns, getDefaultRunIdForMode, launchMockRun } from "./mock-data";
import type { FactoryLaunchPreset } from "./types";

describe("factory v2 mock data", () => {
  it("loads initial runs without import-time errors", () => {
    expect(factoryRuns.length).toBeGreaterThan(0);
    expect(getDefaultRunIdForMode("eternum")).toBeTruthy();
    expect(getDefaultRunIdForMode("blitz")).toBeTruthy();
  });

  it("only exposes slot and mainnet environment options", () => {
    expect(getFactoryEnvironmentOptions("eternum").map((environment) => environment.label)).toEqual([
      "Slot",
      "Mainnet",
    ]);
    expect(getFactoryEnvironmentOptions("blitz").map((environment) => environment.label)).toEqual(["Slot", "Mainnet"]);
  });

  it("uses the same blitz presets on every network", () => {
    expect(getFactoryLaunchPresetsForMode("blitz").map((preset) => preset.name)).toEqual([
      "Sandbox",
      "Open",
      "Duel",
      "Fast",
    ]);
  });

  it("uses the entered game name for a new launch", () => {
    const preset: FactoryLaunchPreset = {
      id: "preset-test",
      mode: "eternum",
      name: "Test preset",
      description: "Test description",
      defaults: {
        startRule: "next_hour",
        devMode: false,
        twoPlayerMode: false,
        singleRealmMode: false,
      },
    };

    const [newRun] = launchMockRun({
      mode: "eternum",
      environment: "slot.eternum",
      preset,
      existingRuns: factoryRuns,
      requestedName: "etrn-crystal-bay-01",
      startAt: getPresetStartAtValue(preset),
      durationMinutes: null,
      twoPlayerMode: false,
      singleRealmMode: false,
    });

    expect(newRun?.name).toBe("etrn-crystal-bay-01");
  });

  it("does not attach duration messaging to eternum launches", () => {
    const preset: FactoryLaunchPreset = {
      id: "preset-test",
      mode: "eternum",
      name: "Test preset",
      description: "Test description",
      defaults: {
        startRule: "next_hour",
        devMode: false,
        twoPlayerMode: false,
        singleRealmMode: false,
      },
    };

    const [newRun] = launchMockRun({
      mode: "eternum",
      environment: "slot.eternum",
      preset,
      existingRuns: factoryRuns,
      requestedName: "etrn-amber-22",
      startAt: getPresetStartAtValue(preset),
      durationMinutes: null,
      twoPlayerMode: false,
      singleRealmMode: false,
    });

    expect(newRun?.steps[0]?.latestEvent).not.toContain("day");
    expect(newRun?.steps[0]?.latestEvent).not.toContain("1h");
  });
});
