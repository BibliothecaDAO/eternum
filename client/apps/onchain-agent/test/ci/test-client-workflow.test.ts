import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkflow(): string {
  const workflowPath = path.resolve(process.cwd(), "../../../.github/workflows/test-client.yml");
  expect(existsSync(workflowPath)).toBe(true);
  return readFileSync(workflowPath, "utf8");
}

describe("test-client workflow", () => {
  it("triggers on client-impacting files and its own workflow contract files", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("paths:");
    expect(workflow).toContain('- ".github/workflows/test-client.yml"');
    expect(workflow).toContain('- "client/apps/game/**"');
    expect(workflow).toContain('- "client/apps/onchain-agent/test/ci/test-client-workflow.test.ts"');
    expect(workflow).not.toContain("paths-ignore:");
  });

  it("runs a lightweight workflow-contract job for workflow-only changes", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("detect-scope:");
    expect(workflow).toContain("workflow-contract:");
    expect(workflow).toContain("has_workflow_contract_changes");
    expect(workflow).toContain(
      "pnpm --dir ./client/apps/onchain-agent exec vitest run test/ci/test-client-workflow.test.ts",
    );
  });

  it("runs the client quality gates instead of skipping the test suite", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("pnpm --dir ./client/apps/game typecheck");
    expect(workflow).toContain("pnpm --dir ./client/apps/game test");
    expect(workflow).toContain("pnpm --dir ./client/apps/game build");
    expect(workflow).not.toContain("if: false # Temporarily disabled");
  });

  it("runs the renderer scene and debug smoke paths against a live local game server", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain('GAME_CLIENT_PREVIEW_URL: "http://127.0.0.1:4173"');
    expect(workflow).toContain('ETERNUM_DISABLE_MKCERT: "true"');
    expect(workflow).toContain("pnpm --dir ./client/apps/game preview --host 127.0.0.1 --port 4173");
    expect(workflow).toContain('curl --fail --silent --show-error "$GAME_CLIENT_PREVIEW_URL"');
    expect(workflow).toContain("node ./client/apps/game/scripts/run-renderer-scene-smoke.mjs");
    expect(workflow).toContain("--scenes map,hex");
    expect(workflow).toContain("node ./client/apps/game/scripts/run-renderer-debug-smoke.mjs");
    expect(workflow).toContain('--base-url "$GAME_CLIENT_PREVIEW_URL"');
    expect(workflow).toContain("--scenarios baseline,stress");
    expect(workflow).toContain("--output /tmp/renderer-debug-smoke.json");
    expect(workflow).toContain("renderer-debug-smoke-result");
  });

  it("sets up pnpm before enabling pnpm caching in setup-node", () => {
    const workflow = readWorkflow();
    const pnpmSetupIndex = workflow.indexOf("uses: pnpm/action-setup@v4");
    const nodeSetupIndex = workflow.indexOf("uses: actions/setup-node@v4");

    expect(pnpmSetupIndex).toBeGreaterThanOrEqual(0);
    expect(nodeSetupIndex).toBeGreaterThanOrEqual(0);
    expect(pnpmSetupIndex).toBeLessThan(nodeSetupIndex);
    expect(workflow).toContain("cache: pnpm");
    expect(workflow).not.toContain("version: 9.7.0");
  });
});
