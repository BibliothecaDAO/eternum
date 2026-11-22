import { describe, expect, it } from "vitest";

import { STEP_SETS } from "./client-playtest/steps.mjs";
import { judgeLanding, LANDING_SCENARIOS, readLandingOptions } from "./run-landing-playtest.mjs";

describe("readLandingOptions", () => {
  it("plays every landing scenario unless scenarios are named, each a step list the playtest has", () => {
    expect(readLandingOptions([]).scenarios).toBe(LANDING_SCENARIOS);
    expect(LANDING_SCENARIOS.filter((scenario) => !STEP_SETS[scenario])).toEqual([]);
    expect(readLandingOptions(["lab-oath-slots", "lab-race"]).scenarios).toEqual(["lab-oath-slots", "lab-race"]);
  });

  it("refuses a scenario the playtest has no step list for, and an option it does not take", () => {
    expect(() => readLandingOptions(["lab-oath-slots", "lab-nowhere"])).toThrow(
      "no playtest step list is named lab-nowhere",
    );
    expect(() => readLandingOptions(["--viewport", "390x844"])).toThrow(
      "playtest:landing takes scenario names, --port and --out, not --viewport",
    );
  });

  it("serves the client on the port asked for and writes where the command was run", () => {
    expect(readLandingOptions(["--port", "4201", "--out", "runs"], "/work")).toMatchObject({
      port: 4201,
      outRoot: "/work/runs",
    });
    expect(readLandingOptions([]).port).toBe(4188);
  });
});

describe("judgeLanding", () => {
  const verdict = (scenario, viewport, status) => ({ scenario, viewport, status });

  it("passes only when every scenario passed at every viewport", () => {
    expect(judgeLanding([verdict("lab-town", "1920x1080", 0), verdict("lab-town", "390x844", 0)])).toEqual({
      failures: [],
      status: 0,
    });
  });

  it("names each scenario and viewport that failed", () => {
    expect(
      judgeLanding([
        verdict("lab-town", "1920x1080", 0),
        verdict("lab-town", "390x844", 1),
        verdict("lab-scouts", "1920x1080", 128),
      ]),
    ).toEqual({ failures: ["lab-town at 390x844 (exit 1)", "lab-scouts at 1920x1080 (exit 128)"], status: 1 });
  });

  it("answers 128 when every failure only refused the machine's load, so the run is taken again", () => {
    expect(judgeLanding([verdict("lab-town", "1920x1080", 128), verdict("lab-scouts", "390x844", 0)])).toEqual({
      failures: ["lab-town at 1920x1080 (exit 128)"],
      status: 128,
    });
  });
});
