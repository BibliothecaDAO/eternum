import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkflow(): string {
  const workflowPath = path.resolve(process.cwd(), "../../../.github/workflows/release-packages-on-changelog.yml");
  expect(existsSync(workflowPath)).toBe(true);
  return readFileSync(workflowPath, "utf8");
}

describe("release packages on changelog workflow", () => {
  it("triggers on main pushes with changelog path filters", () => {
    const workflow = readWorkflow();
    expect(workflow).toContain("on:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches:");
    expect(workflow).toContain("- main");
    expect(workflow).toContain("paths:");
    expect(workflow).toContain("packages/**/changelog.md");
    expect(workflow).toContain("packages/**/CHANGELOG.md");
  });

  it("uses npm token auth and publishes when changelogs changed", () => {
    const workflow = readWorkflow();
    expect(workflow).toContain("NODE_AUTH_TOKEN");
    expect(workflow).toContain("secrets.NPM_TOKEN");
    expect(workflow).toContain("npm publish");
    expect(workflow).toContain("git diff --name-only");
    expect(workflow).toContain("changelog.md");
  });

  it("supports manual dispatch", () => {
    const workflow = readWorkflow();
    expect(workflow).toContain("workflow_dispatch:");
  });
});
