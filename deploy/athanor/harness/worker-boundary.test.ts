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

// The node's socket, as the harness hands it to the SDK: one frame from a real server, read by a listener that parses
// every frame as the SDK's per-request listener does.
const NODE_FRAME_WORKER = `
import { catchUncaughtFailures, frameCheckingSocket, workerBoundaryEvidence } from ${JSON.stringify(resolve(harness, "worker-boundary.ts"))};
import { analyzeHarnessResult } from ${JSON.stringify(resolve(harness, "report.ts"))};
import { createRpcMetrics } from ${JSON.stringify(resolve(harness, "driver.ts"))};
catchUncaughtFailures();
const server = Bun.serve({ port: 0, fetch: (request, server) => server.upgrade(request), websocket: {
  open: (socket) => socket.send(process.env.NODE_FRAME), message() {},
} });
const Socket = frameCheckingSocket(WebSocket);
const socket = new Socket(\`ws://127.0.0.1:\${server.port}/rpc/v0_10_2\`);
let parsed = 0;
socket.addEventListener("message", (event) => { JSON.parse(event.data); parsed++; });
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
  console.log(JSON.stringify({ analysis, workerBoundary, parsed }));
  socket.close();
  server.stop(true);
}, 300);
`;

async function nodeFrameRun(frame: string) {
  const child = Bun.spawn([process.execPath, "-e", NODE_FRAME_WORKER], {
    env: { ...process.env, NODE_FRAME: frame },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [status, output] = await Promise.all([child.exited, new Response(child.stdout).text()]);
  expect(status).toBe(frame === UNSUBSCRIBE_CLOSE ? 0 : 1);
  return JSON.parse(output.trim().split("\n").at(-1)!);
}

// What the pinned Madara sends after a transaction-status unsubscribe: an error string with bare quotes, not JSON.
const UNSUBSCRIBE_CLOSE =
  '{"jsonrpc":"2.0","method":"starknet_V0_10_2_subscribeTransactionStatus","params":{"subscription":"13","error":""code": -32000, "message": Subscription closed"}}';

describe("the node's known unsubscribe frame", () => {
  it("is dropped before the SDK parses it, counted, and does not fail the run", async () => {
    const { analysis, workerBoundary, parsed } = await nodeFrameRun(UNSUBSCRIBE_CLOSE);
    expect(parsed).toBe(0);
    expect(workerBoundary).toEqual({ uncaughtFailures: [], invalidFrames: [], droppedUnsubscribeFrames: 1 });
    expect(analysis.passed).toBe(true);
  });

  it("is the only malformed frame dropped: another still reaches the SDK and fails the run", async () => {
    const other = UNSUBSCRIBE_CLOSE.replace("Subscription closed", "Internal error");
    const { analysis, workerBoundary } = await nodeFrameRun(other);
    expect(workerBoundary.droppedUnsubscribeFrames).toBe(0);
    expect(workerBoundary.invalidFrames).toEqual([expect.objectContaining({ head: other })]);
    expect(workerBoundary.uncaughtFailures).toEqual([
      expect.objectContaining({ kind: "exception", error: expect.stringContaining("JSON Parse error") }),
    ]);
    expect(analysis.checks.noUncaughtFailures).toBe(false);
    expect(analysis.passed).toBe(false);
  });
});

describe("the worker boundary", () => {
  it("keeps a worker whose library callback throws alive to write a report that names the failure", async () => {
    const child = Bun.spawn([process.execPath, "-e", THROWING_WORKER], { stdout: "pipe", stderr: "pipe" });
    const [status, output] = await Promise.all([child.exited, new Response(child.stdout).text()]);
    expect(status).toBe(1);
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
