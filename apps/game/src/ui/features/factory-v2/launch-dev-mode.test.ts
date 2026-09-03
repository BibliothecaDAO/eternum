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

  it("omits the field for a non-dev preset — the launch service rejects a literal false", () => {
    expect(resolveLaunchDevModeOn(presetWithDevMode(false))).toBeUndefined();
  });

  it("omits the field when no preset is selected", () => {
    expect(resolveLaunchDevModeOn(null)).toBeUndefined();
  });
});
