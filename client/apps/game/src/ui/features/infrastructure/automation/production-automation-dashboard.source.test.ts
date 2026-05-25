// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("ProductionAutomationDashboard source", () => {
  it("derives visible skip details from the current status instead of stale execution history", () => {
    const source = readSource("src/ui/features/infrastructure/automation/production-automation-dashboard.tsx");

    expect(source).toContain("realm.lastStatus?.message");
    expect(source).not.toContain("realm.lastExecution?.skipped");
  });
});
