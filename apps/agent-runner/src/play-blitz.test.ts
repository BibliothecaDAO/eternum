import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

function selectGame(name = "") {
  const directory = mkdtempSync(join(tmpdir(), "play-blitz-"));
  directories.push(directory);
  writeFileSync(join(directory, "curl"), '#!/bin/sh\ncat "$DIRECTORY_FIXTURE"\n', { mode: 0o755 });
  writeFileSync(
    join(directory, "games.json"),
    JSON.stringify({
      games: [
        { game_id: 2, name: "older", mode: "blitz", status: "Live", clock: { end_at: 0 } },
        { game_id: 3, name: "newer", mode: "blitz", status: "Registration", clock: { end_at: 0 } },
        { game_id: 4, name: "ended", mode: "blitz", status: "Live", clock: { end_at: 1 } },
        { game_id: 5, name: "eternum", mode: "eternum", status: "Live", clock: { end_at: 0 } },
      ],
    }),
  );
  return spawnSync(
    "bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      'source "$1"; GAME_NAME="$2"; resolve_game_id',
      "test",
      resolve("scripts/play-blitz.sh"),
      name,
    ],
    {
      encoding: "utf8",
      env: {
        BASH_ENV: "/dev/null",
        PATH: `${directory}:${process.env.PATH}`,
        DIRECTORY_FIXTURE: join(directory, "games.json"),
        VITE_PUBLIC_HERALD_URL: "http://fixture",
      },
    },
  );
}

describe("Blitz directory selection", () => {
  it("reads the piped directory and selects the newest open Blitz", () => {
    const result = selectGame();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("3");
  });
  it("honours a named open game", () => expect(selectGame("older").stdout.trim()).toBe("2"));
  it("fails clearly for an ended game", () => {
    const result = selectGame("ended");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("no open Blitz game named ended");
  });
});
