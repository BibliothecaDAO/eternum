// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("bootstrap load timeline instrumentation", () => {
  it("tracks setup and initial sync milestones and records the initial sync duration", () => {
    const source = readSource("src/init/bootstrap.tsx");

    expect(source).toContain('markGameEntryMilestone("setup-started")');
    expect(source).toContain('markGameEntryMilestone("setup-completed")');
    expect(source).toContain('markGameEntryMilestone("initial-sync-started")');
    expect(source).toContain('markGameEntryMilestone("initial-sync-completed")');
    expect(source).toContain('recordGameEntryDuration("initial-sync"');
  });
});
