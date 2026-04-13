import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkflow(): string {
  const workflowPath = path.resolve(process.cwd(), "../../../.github/workflows/test-client.yml");
  expect(existsSync(workflowPath)).toBe(true);
  return readFileSync(workflowPath, "utf8");
}

describe("test-client workflow", () => {
  it("runs the client quality gates instead of skipping the test suite", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("pnpm --dir ./client/apps/game typecheck");
    expect(workflow).toContain("pnpm --dir ./client/apps/game test");
    expect(workflow).toContain("pnpm --dir ./client/apps/game build");
    expect(workflow).not.toContain("if: false # Temporarily disabled");
  });

  it("runs the renderer smoke path against a live local game server", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("pnpm --dir ./client/apps/game preview --host 127.0.0.1 --port 4173");
    expect(workflow).toContain("node ./client/apps/game/scripts/run-renderer-scene-smoke.mjs");
    expect(workflow).toContain("--base-url http://127.0.0.1:4173");
    expect(workflow).toContain("--scenes map,hex");
  });
});
