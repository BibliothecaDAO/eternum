import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { STEP_SETS } from "./client-playtest/steps.mjs";
import { allocateRunDirectory, buildRunUrl, readPlaytestOptions } from "./run-client-playtest.mjs";

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
  it("plays at 1920 by 1080 unless --viewport names another size", () => {
    expect(readPlaytestOptions([]).viewport).toEqual({ width: 1920, height: 1080 });
    expect(readPlaytestOptions(["--viewport", "1280x800"]).viewport).toEqual({ width: 1280, height: 800 });
  });

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

  it("reads a player run as the email the player signs in with", () => {
    expect(readPlaytestOptions(["--player", "player+lane@mail.com"]).player).toBe("player+lane@mail.com");
  });

  it("refuses options that cannot describe a run", () => {
    expect(() => readPlaytestOptions(["--iterations", "0"])).toThrow("--iterations must be an integer of at least 1");
    expect(() => readPlaytestOptions(["--iterations", "two"])).toThrow("--iterations must be an integer of at least 1");
    expect(() => readPlaytestOptions(["--renderer-modes", "webgl"])).toThrow(/--renderer-modes takes/);
    expect(() => readPlaytestOptions(["--renderer-modes", ","])).toThrow(/--renderer-modes takes/);
    expect(() => readPlaytestOptions(["--cpu-throttle", "0.5"])).toThrow(
      "--cpu-throttle must be an integer of at least 1",
    );
    expect(() => readPlaytestOptions(["--viewport", "1440"])).toThrow(/--viewport takes <width>x<height>/);
    // The refusal names every step list the runner can play, as STEP_SETS lists them: a list added there is named here.
    const refusal = (() => {
      try {
        readPlaytestOptions(["--steps", "burst"]);
      } catch (error) {
        return error.message;
      }
      return null;
    })();
    expect(refusal).toMatch(/^--steps takes .*, not "burst"$/);
    const named = refusal.slice("--steps takes ".length, refusal.lastIndexOf(", not ")).split(", ");
    expect(named).toEqual(Object.keys(STEP_SETS));
    expect(named).toEqual(
      expect.arrayContaining(["blitz-plates", "blitz-plates-player", "frontier-plates", "frontier-plates-player"]),
    );
    expect(() => readPlaytestOptions(["--player", ".context/playtest-profiles/clientlane"])).toThrow(
      '--player takes an email, not ".context/playtest-profiles/clientlane"',
    );
  });
});

describe("the page a run opens", () => {
  const game = { chainId: "0xa1", gameId: 16 };
  const devOf = (stepSet, player = null) =>
    new URL(
      buildRunUrl({ baseUrl: "https://127.0.0.1:4173", game, player, rendererMode: "webgpu-auto", stepSet }),
    ).searchParams.get("dev");

  it("keeps the dev overlays off for every spectator list that does not play the dev tools", () => {
    const ordinary = Object.keys(STEP_SETS).filter((stepSet) => !stepSet.endsWith("frozen-sun"));
    expect(ordinary).toContain("blitz-still-map");
    for (const stepSet of ordinary) expect([stepSet, devOf(stepSet)]).toEqual([stepSet, "0"]);
  });

  it("turns them on for the lists that hold the sun through the dev tools", () => {
    expect(devOf("still-map-frozen-sun")).toBe("1");
    expect(devOf("blitz-still-map-frozen-sun")).toBe("1");
  });

  it("opens a player's home page, not the game", () => {
    const url = new URL(
      buildRunUrl({
        baseUrl: "https://127.0.0.1:4173",
        game,
        player: "a@b.c",
        rendererMode: "webgpu-auto",
        stepSet: "blitz-orders",
      }),
    );
    expect([url.pathname, url.searchParams.get("spectate")]).toEqual(["/", null]);
  });
});
