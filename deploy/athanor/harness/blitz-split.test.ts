import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BLITZ_SLOT_PREPARATION_SECONDS } from "../../../packages/value-ledger/src/blitz-timetable";
import { slotLaunches } from "./blitz-split";

test("the offline command compiles every player's game without shard credentials", () => {
  const out = join(mkdtempSync(join(tmpdir(), "blitz-dry-run-")), "launches.json");
  const result = Bun.spawnSync([process.execPath, "blitz-split.ts", "--players", "25", "--dry-run", "--out", out], {
    cwd: import.meta.dir,
    env: { PATH: process.env.PATH },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  const report = JSON.parse(readFileSync(out, "utf8"));
  expect(report.dryRun).toBe(true);
  expect(report.players).toBe(25);
  expect(report.games.map((game: { players: number }) => game.players)).toEqual([13, 12]);
  for (const game of report.games) {
    expect(game.presetId).toBe(2);
    expect(game.calldata[1]).toBe("2");
    expect(game.calldata.length).toBeGreaterThan(game.players * 2);
  }
});

test("a 2,000-player slot is the production split, dealt to the pool by group index, its settling open now", () => {
  const seaters = Array.from({ length: 16 }, (_, index) => `0x${(index + 1).toString(16)}`);
  const before = Math.floor(Date.now() / 1000);
  const launches = slotLaunches(2000, seaters, Date.now());
  expect(launches.length).toBe(84);
  expect(launches.reduce((sum, launch) => sum + launch.players.length, 0)).toBe(2000);
  expect(new Set(launches.flatMap((launch) => launch.players.map((seat) => seat.account))).size).toBe(2000);
  expect(launches.map((launch) => launch.seater)).toEqual(launches.map((_, index) => seaters[index % 16]));
  for (const launch of launches) {
    const settlingOpens = Date.parse(launch.request.gameStartTime!) / 1000 - BLITZ_SLOT_PREPARATION_SECONDS;
    expect(settlingOpens - before).toBeGreaterThanOrEqual(0);
    expect(settlingOpens - before).toBeLessThanOrEqual(2);
  }
});
