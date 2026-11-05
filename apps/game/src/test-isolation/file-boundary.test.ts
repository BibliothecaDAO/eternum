// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const gameRoot = fileURLToPath(new URL("../..", import.meta.url));
const fixtures = fileURLToPath(new URL("./fixtures", import.meta.url));

/** Runs the fixtures through the client's vitest config on one worker, so each file follows another on it. */
const runFixturesOnOneWorker = () => {
  const out = mkdtempSync(path.join(tmpdir(), "file-boundary-"));
  try {
    spawnSync(
      process.execPath,
      [
        path.join(gameRoot, "node_modules/vitest/vitest.mjs"),
        "run",
        fixtures,
        "--maxWorkers=1",
        "--minWorkers=1",
        "--reporter=json",
        `--outputFile=${path.join(out, "report.json")}`,
      ],
      { cwd: gameRoot, env: { ...process.env, ETERNUM_FILE_BOUNDARY: "1" }, encoding: "utf8" },
    );
    const report = JSON.parse(readFileSync(path.join(out, "report.json"), "utf8")) as {
      testResults: { name: string; status: string; message: string }[];
    };
    return report.testResults.map(({ name, status, message }) => ({ file: path.basename(name), status, message }));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
};

it("gives each file on a reused worker an empty performance timeline, and fails a file that leaves process changed", () => {
  const files = runFixturesOnOneWorker().sort((a, b) => a.file.localeCompare(b.file));

  expect(files.map(({ file, status }) => [file, status])).toEqual([
    ["leaves-process-changed.test.ts", "failed"],
    ["timeline-dom-a.test.ts", "passed"],
    ["timeline-dom-b.test.ts", "passed"],
    ["timeline-node-a.test.ts", "passed"],
    ["timeline-node-b.test.ts", "passed"],
  ]);
  expect(files[0].message).toContain("process.env.FILE_BOUNDARY_LEFT");
  expect(files[0].message).toContain('a "file-boundary-left" listener on process');
}, 60_000);
