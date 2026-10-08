import { expect, it } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");

it("a queued ticket-socket open after disposal neither resubscribes nor dereferences the closed channel", async () => {
  const code = `
    import { config } from "starknet";
    import { createNativeTicketSubmission } from ${JSON.stringify(join(root, "packages/provider/src/native-ticket.ts"))};
    import { catchUncaughtFailures, workerBoundaryEvidence } from ${JSON.stringify(join(import.meta.dir, "worker-boundary.ts"))};
    catchUncaughtFailures();
    let socket;
    class PendingSocket extends EventTarget {
      readyState = 0; closed = 0; sent = [];
      constructor(url) { super(); this.url = url; socket = this; }
      send(data) { this.sent.push(data); }
      close() { this.closed++; this.readyState = 3; queueMicrotask(() => this.dispatchEvent(new Event("close"))); }
    }
    config.set("websocket", PendingSocket);
    const submit = createNativeTicketSubmission("http://node.test/rpc");
    const pending = submit({ intent: ["0x1"], signature: ["0x2"] }).catch(error => error.message);
    submit.dispose();
    submit.dispose();
    socket.dispatchEvent(new Event("open"));
    await pending;
    setTimeout(() => console.log(JSON.stringify({ closed: socket.closed, sent: socket.sent, boundary: workerBoundaryEvidence() })), 10);
  `;
  const child = Bun.spawn([process.execPath, "-e", code], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const [status, output] = await Promise.all([child.exited, new Response(child.stdout).text()]);
  expect(status).toBe(0);
  expect(JSON.parse(output.trim().split("\n").at(-1)!)).toMatchObject({
    closed: 1,
    sent: [],
    boundary: { uncaughtFailures: [] },
  });
});

it.each(["exception", "rejection", "exit", "exit-hook", "workload", "clean"])(
  "commits the verdict only after a late %s, with the final failure and exit code",
  async (kind) => {
    const output = await mkdtemp(join(tmpdir(), "harness-completion-"));
    const code = `
    import { existsSync, readdirSync } from "node:fs";
    import { writeHarnessReport } from ${JSON.stringify(join(import.meta.dir, "report.ts"))};
    import { createRpcMetrics } from ${JSON.stringify(join(import.meta.dir, "driver.ts"))};
    import { catchUncaughtFailures } from ${JSON.stringify(join(import.meta.dir, "worker-boundary.ts"))};
    catchUncaughtFailures();
    await writeHarnessReport({
      functional: true, accounts: [], botCount: 0, chainId: "0x1",
      games: [{ gameId: 1, gameName: "completed", botCount: 0, settlementTransactions: 0 }],
      intervalSeconds: 1, gates: ${kind === "workload" ? '{ minimumThresholdActions: 1, evidence: { gitDirty: false, gitRevision: "test" } }' : "null"}, minutes: 1, receipts: {}, rpcUrl: "http://node.test", setupTransactions: [],
      heraldUrl: "http://herald.test", driver: {},
      workload: { profile: "cadence", actions: [], overheadRpc: createRpcMetrics(), plannedActions: 0,
        ticks: 0, readinessWaitMs: 0, startedAt: "2026-10-07T00:00:00Z", endedAt: "2026-10-07T00:01:00Z" },
    }, result => console.log(JSON.stringify({ result })));
    console.log(JSON.stringify({ prematureReports: readdirSync(process.env.HARNESS_OUTPUT_DIRECTORY).length }));
    ${kind === "exit-hook" ? 'process.on("exit", () => { throw new Error("late exit hook"); });' : ""}
    setTimeout(() => {
      ${kind === "exception" ? 'throw new Error("late cleanup exception")' : kind === "rejection" ? 'Promise.reject(new Error("late cleanup rejection"))' : kind === "exit" ? "process.exitCode = 7" : ""};
    }, 5);
  `;
    try {
      const child = Bun.spawn([process.execPath, "-e", code], {
        cwd: root,
        env: { ...process.env, HARNESS_OUTPUT_DIRECTORY: output },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [status, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()]);
      expect(status).toBe(kind === "exit" ? 7 : kind === "clean" ? 0 : 1);
      const messages = stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(messages[0]).toEqual({ prematureReports: 0 });
      expect(messages.at(-1).result.passed).toBe(kind === "clean" || kind === "exit-hook");
      const files = await readdir(output);
      expect(files).toHaveLength(1);
      const report = JSON.parse(await readFile(join(output, files[0]!), "utf8"));
      expect(report.passed).toBe(kind === "clean");
      expect(report.thresholds.checks.cleanProcessExit).toBe(kind === "clean");
      if (kind !== "exit" && kind !== "clean" && kind !== "workload") {
        expect(report.thresholds.checks.noUncaughtFailures).toBe(false);
        expect(report.workload.uncaughtFailures).toEqual([
          expect.objectContaining({ kind: kind === "rejection" ? "rejection" : "exception" }),
        ]);
      }
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  },
);
