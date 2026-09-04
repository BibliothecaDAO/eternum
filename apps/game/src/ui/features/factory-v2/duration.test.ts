import { describe, expect, it } from "vitest";

import { buildBlitzDurationOptions, formatFactoryDurationLabel, supportsFactoryDuration } from "./duration";
import type { FactoryLaunchPreset } from "./types";

const buildPreset = (id: string, durationMinutes: number): FactoryLaunchPreset => ({
  id,
  mode: "blitz",
  name: id,
  description: "test",
  defaults: {
    startRule: "next_hour",
    durationMinutes,
    devMode: false,
    twoPlayerMode: false,
    singleRealmMode: false,
  },
});

describe("factory duration helpers", () => {
  it("formats common duration labels cleanly", () => {
    expect(formatFactoryDurationLabel(60)).toBe("1h");
    expect(formatFactoryDurationLabel(90)).toBe("1h 30m");
    expect(formatFactoryDurationLabel(5 * 24 * 60)).toBe("5 days");
  });

  it("only enables duration controls for blitz", () => {
    expect(supportsFactoryDuration("blitz")).toBe(true);
    expect(supportsFactoryDuration("eternum")).toBe(false);
  });

  it("keeps the selected duration in the option list", () => {
    const presets = [buildPreset("fast", 60), buildPreset("open", 90)];

    expect(buildBlitzDurationOptions(presets, 120)).toEqual([
      { value: 60, label: "1h" },
      { value: 90, label: "1h 30m" },
      { value: 120, label: "2h" },
      { value: 7200, label: "5 days" },
    ]);
  });
});
