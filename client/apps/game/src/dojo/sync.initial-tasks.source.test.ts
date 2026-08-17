// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("initial sync required tasks", () => {
  it("awaits required background tasks before reporting initial sync complete", () => {
    const source = readSource("src/dojo/sync.ts");
    const requiredTaskJoin = source.indexOf("await Promise.all([");
    const bankTask = source.indexOf('label: "bank structures query"');
    const supportDataSync = source.indexOf("await syncInitialSupportData(");
    const completion = source.indexOf("reportProgress(100)");

    expect(requiredTaskJoin).toBeGreaterThan(-1);
    expect(bankTask).toBeGreaterThan(requiredTaskJoin);
    expect(supportDataSync).toBeGreaterThan(bankTask);
    expect(completion).toBeGreaterThan(supportDataSync);
  });
});
