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
    expect(() => readPlaytestOptions(["--steps", "burst"])).toThrow(
      '--steps takes spectator, unit-assets-spectator, knight-spectator, knight-blitz-spectator, player, ownership-rings, blitz-orders, blitz-spectator, blitz-burst, still-map, still-map-frozen-sun, blitz-still-map, blitz-still-map-frozen-sun, not "burst"',
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
