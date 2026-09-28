import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { frameCheckingSocket, workerBoundaryEvidence } from "./worker-boundary";

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
    const child = Bun.spawn([process.execPath, "-e", THROWING_WORKER], { stdout: "pipe", stderr: "pipe" });
    const [status, output] = await Promise.all([child.exited, new Response(child.stdout).text()]);
    expect(status).toBe(0);
    const { analysis, workerBoundary } = JSON.parse(output.trim().split("\n").at(-1)!);
    expect(workerBoundary.uncaughtFailures).toEqual([
      expect.objectContaining({ kind: "exception", error: expect.stringContaining("JSON Parse error") }),
    ]);
    expect(analysis.checks.noUncaughtFailures).toBe(false);
    expect(analysis.passed).toBe(false);
  });

  it("records a frame that is not JSON before the library parses it, and passes JSON through", () => {
    class FakeSocket extends EventTarget {
      constructor(readonly url: string) {
        super();
      }
    }
    const Socket = frameCheckingSocket(FakeSocket as unknown as typeof WebSocket);
    const socket = new Socket("ws://node.test/rpc");
    const truncated = `{"jsonrpc":"2.0","method":"starknet_subscriptionTransactionStatus","params":{"result":`;
    socket.dispatchEvent(new MessageEvent("message", { data: '{"jsonrpc":"2.0","id":1,"result":"0x1"}' }));
    socket.dispatchEvent(new MessageEvent("message", { data: truncated }));
    expect(workerBoundaryEvidence().invalidFrames).toEqual([
      expect.objectContaining({
        url: "ws://node.test/rpc",
        length: truncated.length,
        head: truncated,
        tail: truncated,
      }),
    ]);
  });
});
