import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executionLog } from "./execution-log";

test("a shorter execution cannot retain a previous success or failure in either log", async () => {
  const directory = await mkdtemp(join(tmpdir(), "execution-log-"));
  const stdout = join(directory, "stdout.log");
  const stderr = join(directory, "stderr.log");
  try {
    for (const path of [stdout, stderr]) await writeFile(path, "[PASS] stale case\n[FAIL] stale case\n");
    const child = Bun.spawn([process.execPath, "-e", 'process.stdout.write("current\\n")'], {
      stdout: await executionLog(stdout),
      stderr: await executionLog(stderr),
    });
    expect(await child.exited).toBe(0);
    expect(await readFile(stdout, "utf8")).toBe("current\n");
    expect(await readFile(stderr, "utf8")).toBe("");
  } finally {
    await rm(directory, { recursive: true });
  }
});
