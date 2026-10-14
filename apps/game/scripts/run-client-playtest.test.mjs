import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { allocateRunDirectory, readPlaytestOptions } from "./run-client-playtest.mjs";

describe("allocateRunDirectory", () => {
  it("gives every invocation a new directory and never writes into an existing one", () => {
    const root = mkdtempSync(join(tmpdir(), "playtest-root-"));
    const first = allocateRunDirectory(root, "spectator", new Date("2026-10-14T18:00:00.000Z"));
    writeFileSync(join(first, "summary.json"), "{}");
    const second = allocateRunDirectory(root, "spectator", new Date("2026-10-14T18:05:00.000Z"));

    expect(second).not.toBe(first);
    expect(readdirSync(first)).toEqual(["summary.json"]);
    expect(() => allocateRunDirectory(root, "spectator", new Date("2026-10-14T18:00:00.000Z"))).toThrow(/EEXIST/);
    rmSync(root, { recursive: true });
  });
});

describe("readPlaytestOptions", () => {
  it("reads a spectator run with its defaults, paths taken from where the command was run", () => {
    expect(readPlaytestOptions(["--out", "runs", "--iterations", "2"], "/work")).toMatchObject({
      baseUrl: null,
      iterations: 2,
      outRoot: "/work/runs",
      player: null,
      port: 4173,
      rendererModes: ["webgpu-auto", "webgpu-force-webgl"],
    });
  });

  it("refuses options that cannot describe a run", () => {
    expect(() => readPlaytestOptions(["--iterations", "0"])).toThrow("--iterations must be an integer of at least 1");
    expect(() => readPlaytestOptions(["--iterations", "two"])).toThrow("--iterations must be an integer of at least 1");
    expect(() => readPlaytestOptions(["--renderer-modes", "webgl"])).toThrow(/--renderer-modes takes/);
    expect(() => readPlaytestOptions(["--renderer-modes", ","])).toThrow(/--renderer-modes takes/);
    expect(() => readPlaytestOptions(["--cpu-throttle", "0.5"])).toThrow(
      "--cpu-throttle must be an integer of at least 1",
    );
    expect(() => readPlaytestOptions(["--player", "/no/such/profile"])).toThrow(/is not a browser profile directory/);
  });
});
