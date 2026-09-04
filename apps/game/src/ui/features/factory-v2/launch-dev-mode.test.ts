import { describe, expect, it } from "vitest";
import { resolveLaunchDevModeOn } from "./launch-dev-mode";
import type { FactoryLaunchPreset } from "./types";

const presetWithDevMode = (devMode: boolean): FactoryLaunchPreset => ({
  id: "test",
  mode: "blitz",
  name: "Test",
  description: "",
  defaults: { startRule: "next_hour", devMode, twoPlayerMode: false, singleRealmMode: false },
});

describe("resolveLaunchDevModeOn", () => {
  it("sends true for a dev-mode preset", () => {
    expect(resolveLaunchDevModeOn(presetWithDevMode(true))).toBe(true);
  });

  it("sends false for a non-dev preset — a real game respects start-time gates", () => {
    expect(resolveLaunchDevModeOn(presetWithDevMode(false))).toBe(false);
  });

  it("sends false when no preset is selected", () => {
    expect(resolveLaunchDevModeOn(null)).toBe(false);
  });
});
