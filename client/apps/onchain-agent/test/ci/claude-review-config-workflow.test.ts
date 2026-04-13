import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkflow(): string {
  const workflowPath = path.resolve(process.cwd(), "../../../.github/workflows/claude-review-config.yml");
  expect(existsSync(workflowPath)).toBe(true);
  return readFileSync(workflowPath, "utf8");
}

describe("claude-review-config workflow", () => {
  it("treats the Claude review step as advisory instead of failing the whole job", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("- name: Run Claude Config Code Review");
    expect(workflow).toContain("continue-on-error: true");
  });
});
