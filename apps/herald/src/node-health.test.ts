import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { readNodeHealth } from "./node-health";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));
const sampleFile = (content: string) => {
  const directory = mkdtempSync(join(tmpdir(), "node-health-"));
  directories.push(directory);
  writeFileSync(join(directory, "node-health.json"), content);
  return join(directory, "node-health.json");
};

it("reads the collector's sample, a stopped node's included, and reads nothing it cannot trust", () => {
  const sample = { sampled_at: 1_800_000_000, memory_bytes: 1_900_000_000, host_memory_bytes: 96_000_000_000 };
  expect(readNodeHealth(sampleFile(JSON.stringify(sample)))).toEqual(sample);
  expect(readNodeHealth(sampleFile(JSON.stringify({ ...sample, memory_bytes: null })))).toEqual({
    ...sample,
    memory_bytes: null,
  });
  expect(readNodeHealth("/nonexistent/node-health.json")).toBeNull();
  expect(readNodeHealth(sampleFile("{"))).toBeNull();
  expect(readNodeHealth(sampleFile(JSON.stringify({ ...sample, memory_bytes: -1 })))).toBeNull();
  expect(readNodeHealth(sampleFile(JSON.stringify({ memory_bytes: 1 })))).toBeNull();
  for (const notASample of ["null", "[]", '"sample"', "7"]) expect(readNodeHealth(sampleFile(notASample))).toBeNull();
});
