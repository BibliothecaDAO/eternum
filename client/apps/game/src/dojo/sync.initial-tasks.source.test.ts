// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("initial sync required tasks", () => {
  it("awaits required background tasks before reporting initial sync complete", () => {
    const source = readSource("src/dojo/sync.ts");
    const bankTask = source.indexOf('runTimedTask("bank structures query"');
    const requiredTaskJoin = source.indexOf("await Promise.all(parallelTasks)");
    const completion = source.indexOf("updateProgress(100)");

    expect(bankTask).toBeGreaterThan(-1);
    expect(requiredTaskJoin).toBeGreaterThan(bankTask);
    expect(requiredTaskJoin).toBeLessThan(completion);
  });
});
