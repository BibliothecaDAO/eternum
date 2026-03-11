import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkflow(): string {
  const workflowPath = path.resolve(process.cwd(), "../../../.github/workflows/release-onchain-agent.yml");
  expect(existsSync(workflowPath)).toBe(true);
  return readFileSync(workflowPath, "utf8");
}

describe("release-onchain-agent workflow", () => {
  it("supports semver tag and manual dispatch triggers", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("on:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain('- "v*.*.*"');
    expect(workflow).toContain("workflow_dispatch:");
  });

  it("runs quality gates before packaging", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("pnpm --dir client/apps/onchain-agent test");
    expect(workflow).toContain("pnpm --dir client/apps/onchain-agent build");
    expect(workflow).toContain("pnpm --dir packages/game-agent test");
    expect(workflow).toContain("pnpm --dir packages/client test");
  });

  it("packages all V1 targets and publishes release assets", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("darwin-arm64");
    expect(workflow).toContain("darwin-x64");
    expect(workflow).toContain("linux-x64");
    expect(workflow).toContain("linux-arm64");

    expect(workflow).toContain("pnpm --dir client/apps/onchain-agent package:release");
    expect(workflow).toContain("axis --version");
    expect(workflow).toContain("axis doctor");
    expect(workflow).toContain("checksums.txt");
    expect(workflow).toContain("scripts/install-axis.sh");
    expect(workflow).toContain("softprops/action-gh-release");
  });
});
