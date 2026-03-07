import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSyncSource(): string {
  const dojoDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(dojoDir, "sync.ts"), "utf8");
}

describe("initialSync startup scheduling", () => {
  it("runs the independent startup fetches through the parallel task queue", () => {
    const source = readSyncSource();

    expect(source).toContain('runTimedTask("config query"');
    expect(source).toContain('runTimedTask("address names query"');
    expect(source).toContain('runTimedTask("guilds query"');
    expect(source).toContain('runTimedTask("map data refresh"');
    expect(source).toContain("await Promise.all(parallelTasks)");
  });
});
