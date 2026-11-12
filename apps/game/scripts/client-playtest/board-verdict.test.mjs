import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readBoardRun } from "./board-verdict.mjs";
import { STEP_SETS } from "./steps.mjs";

const MODES = ["webgpu-auto", "webgpu-force-webgl"];
const SHOTS = ["realm", "north"];
const made = [];
afterEach(() => made.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A run directory as the playtest leaves it: a transcript and a still for each view, on each backend. */
function runDir({ failing = null, stillLost = null, ok = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "board-run-"));
  made.push(dir);
  for (const mode of MODES) {
    const steps = SHOTS.map((name) => ({
      name,
      gpuDoneMs: { p50: 3.2, p95: 4.1 },
      verdict: name === failing ? { status: "failed", reason: "the map reported no camera" } : { status: "completed" },
    }));
    writeFileSync(join(dir, `spectator-${mode}-1-transcript.json`), JSON.stringify({ ok, steps }));
    SHOTS.forEach((name, index) => {
      if (name !== stillLost) writeFileSync(join(dir, `spectator-${mode}-1-0${index + 1}-${name}.png`), "");
    });
  }
  return dir;
}

describe("the board's verdict on a run", () => {
  it("has no problem when the run exited cleanly with every view completed and shot on both backends", () => {
    const run = readBoardRun({ dir: runDir(), exit: 0, signal: null }, MODES, SHOTS);
    expect(run.problems).toEqual([]);
    expect(run.modes["webgpu-auto"].gpu.north).toEqual({ p50: 3.2, p95: 4.1 });
  });

  it("fails a run that could not reach its client and left nothing", () => {
    const run = readBoardRun({ dir: null, exit: 1, signal: null }, MODES, SHOTS);
    expect(run.problems).toEqual(["the playtest exited 1", "the playtest left no run directory"]);
  });

  it("fails a run stopped by a signal", () => {
    expect(readBoardRun({ dir: runDir(), exit: null, signal: "SIGTERM" }, MODES, SHOTS).problems).toEqual([
      "the playtest was stopped by SIGTERM",
    ]);
  });

  it("fails a failed view, a lost still and a run that did not pass, on the backend they happened on", () => {
    const run = readBoardRun(
      { dir: runDir({ failing: "north", stillLost: "realm", ok: false }), exit: 1 },
      MODES,
      SHOTS,
    );
    expect(run.problems).toContain("webgpu-auto north: failed: the map reported no camera");
    expect(run.problems).toContain("webgpu-force-webgl realm: no still");
    expect(run.problems).toContain("webgpu-auto: the run did not pass");
  });

  it("fails a backend that left no transcript", () => {
    const dir = runDir();
    rmSync(join(dir, "spectator-webgpu-force-webgl-1-transcript.json"));
    expect(readBoardRun({ dir, exit: 0 }, MODES, SHOTS).problems).toEqual(["webgpu-force-webgl: no transcript"]);
  });
});

describe("the board's views", () => {
  const verifyOf = (name) => STEP_SETS.board.steps.find((step) => step.name === name).verify;
  const onTheMap = { scene: "map", rendered: "map", place: "Ethereal I" };

  it("fail a view whose camera the map never reported", () => {
    expect(verifyOf("ethereal-1")({ seen: onTheMap, played: { after: null } })).toMatchObject({
      status: "failed",
      reason: "the map reported no camera",
    });
  });

  it("fail a view whose distance the map did not report, instead of taking the opening one", () => {
    expect(verifyOf("ethereal-1")({ seen: onTheMap, played: { after: { col: 0, row: 100 } } })).toMatchObject({
      status: "failed",
      reason: "the map reported no camera distance",
    });
  });

  it("complete on the layer and at the distance the map reports", () => {
    const played = { after: { col: 0, row: 100, distance: 20 } };
    expect(verifyOf("ethereal-1")({ seen: onTheMap, played })).toMatchObject({ status: "completed", distance: 20 });
    expect(verifyOf("ethereal-1")({ seen: onTheMap, played: { after: { col: 0, row: 0, distance: 20 } } }).status).toBe(
      "failed",
    );
  });
});
