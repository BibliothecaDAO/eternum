import { describe, expect, it } from "vitest";

import { STEP_SETS } from "./client-playtest/steps.mjs";
import {
  defaultWidth,
  judgeLanding,
  LANDING_SCENARIOS,
  landingRuns,
  playEach,
  readLandingOptions,
} from "./run-landing-playtest.mjs";

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
      "playtest:landing takes scenario names, --port, --out and --width, not --viewport",
    );
    expect(() => readLandingOptions(["--width", "0"])).toThrow("--width must be a whole number of runs, at least 1");
  });

  it("plays as many runs at once as asked, else one for every four cores", () => {
    expect(readLandingOptions(["--width", "6"]).width).toBe(6);
    expect([defaultWidth(24), defaultWidth(16), defaultWidth(2)]).toEqual([6, 4, 1]);
  });

  it("serves the client on the port asked for and writes where the command was run", () => {
    expect(readLandingOptions(["--port", "4201", "--out", "runs"], "/work")).toMatchObject({
      port: 4201,
      outRoot: "/work/runs",
    });
    expect(readLandingOptions([]).port).toBe(4188);
  });
});

describe("playEach", () => {
  const runs = landingRuns(["lab-town", "lab-scouts", "lab-oath-slots"], "/run");
  const settle = () => new Promise((resolveTick) => setTimeout(resolveTick, 1));

  it("gives every scenario at every viewport its own evidence folder", () => {
    expect(runs.map(({ out }) => out)).toEqual([
      "/run/lab-town/1920x1080",
      "/run/lab-town/390x844",
      "/run/lab-scouts/1920x1080",
      "/run/lab-scouts/390x844",
      "/run/lab-oath-slots/1920x1080",
      "/run/lab-oath-slots/390x844",
    ]);
  });

  it("plays each run once, never more than the width at a time, and answers in the runs' order", async () => {
    const played = [];
    let playing = 0;
    let most = 0;
    const play = async ({ out }) => {
      played.push(out);
      most = Math.max(most, ++playing);
      await settle();
      playing -= 1;
      return 0;
    };
    const verdicts = await playEach(runs, 4, play);
    expect(played.toSorted()).toEqual(runs.map(({ out }) => out).toSorted());
    expect(most).toBe(4);
    expect(verdicts).toEqual(runs.map((run) => ({ ...run, status: 0 })));
  });

  it("keeps playing past a run that fails or throws, each taking only its own verdict", async () => {
    const play = async ({ scenario, viewport }) => {
      await settle();
      if (scenario === "lab-town" && viewport === "390x844") return 1;
      if (scenario === "lab-scouts" && viewport === "1920x1080") throw new Error("no browser");
      return 0;
    };
    const verdicts = await playEach(runs, 3, play);
    expect(verdicts.map(({ status }) => status)).toEqual([0, 1, 1, 0, 0, 0]);
    expect(judgeLanding(verdicts).failures).toEqual([
      "lab-town at 390x844 (exit 1)",
      "lab-scouts at 1920x1080 (exit 1)",
    ]);
  });

  it("starts no run once told to stop, and answers only the runs played", async () => {
    let started = 0;
    const play = async () => {
      started += 1;
      await settle();
      return 0;
    };
    const verdicts = await playEach(runs, 2, play, () => started >= 2);
    expect(started).toBe(2);
    expect(verdicts.map(({ out }) => out)).toEqual(["/run/lab-town/1920x1080", "/run/lab-town/390x844"]);
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
