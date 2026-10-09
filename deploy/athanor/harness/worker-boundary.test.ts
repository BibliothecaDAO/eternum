import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

const harness = import.meta.dir;

// The harness runs under plain bun, whose process handlers catch what a library callback throws; bun test's runner does
// not, so the worker is its own process here.
const THROWING_WORKER = `
import { catchUncaughtFailures, workerBoundaryEvidence } from ${JSON.stringify(resolve(harness, "worker-boundary.ts"))};
import { analyzeHarnessResult } from ${JSON.stringify(resolve(harness, "report.ts"))};
import { createRpcMetrics } from ${JSON.stringify(resolve(harness, "driver.ts"))};
catchUncaughtFailures();
const socket = new EventTarget();
socket.addEventListener("message", () => JSON.parse('{"result":'));
setTimeout(() => socket.dispatchEvent(new Event("message")), 5);
setTimeout(() => {
  const workerBoundary = workerBoundaryEvidence();
  const analysis = analyzeHarnessResult({
    accounts: [],
    functional: true,
    gates: null,
    setupTransactions: [],
    workload: { actions: [], profile: "cadence", overheadRpc: createRpcMetrics() },
    workerBoundary,
  });
  console.log(JSON.stringify({ analysis, workerBoundary }));
}, 50);
`;

describe("the worker boundary", () => {
  it("keeps a worker whose library callback throws alive to write a report that names the failure", async () => {
    const child = Bun.spawn(
      [process.execPath, "--tsconfig-override", resolve(import.meta.dir, "tsconfig.json"), "-e", THROWING_WORKER],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [status, output] = await Promise.all([child.exited, new Response(child.stdout).text()]);
    expect(status).toBe(1);
    const { analysis, workerBoundary } = JSON.parse(output.trim().split("\n").at(-1)!);
    expect(workerBoundary.uncaughtFailures).toEqual([
      expect.objectContaining({ kind: "exception", error: expect.stringContaining("JSON Parse error") }),
    ]);
    expect(analysis.checks.noUncaughtFailures).toBe(false);
    expect(analysis.passed).toBe(false);
  });
});
