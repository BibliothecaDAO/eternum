import { expect, it } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

it.each(["exception", "rejection", "exit", "exit-hook", "exit-code-hook", "workload", "clean"])(
  "publishes only after actual process exit, including a late %s",
  async (kind) => {
    const output = await mkdtemp(join(tmpdir(), "harness-completion-"));
    const code = `
      import { readdirSync } from "node:fs";
      import { prepareHarnessReport } from ${JSON.stringify(join(import.meta.dir, "report.ts"))};
      import { sendPreparedReport } from ${JSON.stringify(join(import.meta.dir, "terminal-report.ts"))};
      import { createRpcMetrics } from ${JSON.stringify(join(import.meta.dir, "driver.ts"))};
      import { catchUncaughtFailures } from ${JSON.stringify(join(import.meta.dir, "worker-boundary.ts"))};
      catchUncaughtFailures();
      await sendPreparedReport(await prepareHarnessReport({
        functional: true, accounts: [], botCount: 0, chainId: "0x1",
        games: [{ gameId: 1, gameName: "completed", botCount: 0, settlementTransactions: 0 }],
        intervalSeconds: 1, gates: ${kind === "workload" ? '{ minimumThresholdActions: 1, evidence: { gitDirty: false, gitRevision: "test" } }' : "null"},
        minutes: 1, receipts: {}, rpcUrl: "http://node.test", setupTransactions: [], heraldUrl: "http://herald.test", driver: {},
        workload: { profile: "cadence", actions: [], overheadRpc: createRpcMetrics(), plannedActions: 0,
          ticks: 0, readinessWaitMs: 0, startedAt: "2026-10-07T00:00:00Z", endedAt: "2026-10-07T00:01:00Z" },
      }));
      console.log(JSON.stringify({ prematureReports: readdirSync(process.env.HARNESS_OUTPUT_DIRECTORY).filter(file => file.endsWith(".json")).length }));
      ${kind === "exit-hook" ? 'process.on("exit", () => { throw new Error("late exit hook"); });' : ""}
      ${kind === "exit-code-hook" ? 'process.on("exit", () => { process.exitCode = 7; });' : ""}
      setTimeout(() => {
        ${kind === "exception" ? 'throw new Error("late cleanup exception")' : kind === "rejection" ? 'Promise.reject(new Error("late cleanup rejection"))' : kind === "exit" ? "process.exitCode = 7" : ""};
      }, 5);
    `;
    const supervisor = `
      import { superviseHarnessProcess } from ${JSON.stringify(join(import.meta.dir, "terminal-report.ts"))};
      const outcome = await superviseHarnessProcess([process.execPath, "-e", ${JSON.stringify(code)}], process.env);
      console.log(JSON.stringify({ result: outcome.reports[0] }));
      process.exitCode = outcome.exitCode;
    `;
    try {
      const child = Bun.spawn([process.execPath, "-e", supervisor], {
        cwd: root,
        env: { ...process.env, HARNESS_OUTPUT_DIRECTORY: output },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [status, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()]);
      expect(status).toBe(kind === "exit" || kind === "exit-code-hook" ? 7 : kind === "clean" ? 0 : 1);
      const messages = stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(messages[0]).toEqual({ prematureReports: 0 });
      expect(messages.at(-1).result.passed).toBe(kind === "clean");
      const files = await readdir(output);
      expect(files).toHaveLength(1);
      const report = JSON.parse(await readFile(join(output, files[0]!), "utf8"));
      expect(report.passed).toBe(kind === "clean");
      expect(report.driverExitCode).toBe(status);
      expect(report.workload.plannedActions).toBe(0);
      expect(report.thresholds.checks.cleanProcessExit).toBe(kind === "clean");
      if (!["exit", "exit-code-hook", "clean", "workload"].includes(kind)) {
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

it("a roster's metrics survive a later nonzero driver exit without any successful summary", async () => {
  const output = await mkdtemp(join(tmpdir(), "harness-roster-completion-"));
  const terminal = join(import.meta.dir, "terminal-report.ts");
  const code = `
    import { sendPreparedReport } from ${JSON.stringify(terminal)};
    await sendPreparedReport({ path: process.env.HARNESS_OUTPUT_DIRECTORY + "/summary.json", workloadPassed: true,
      report: { games: [{gameId: 1, botCount: 2000}], gates: { passed: true }, reports: [] } });
    process.on("exit", () => { process.exitCode = 7; });
  `;
  const supervisor = `
    import { superviseHarnessProcess } from ${JSON.stringify(terminal)};
    const outcome = await superviseHarnessProcess([process.execPath, "-e", ${JSON.stringify(code)}], process.env);
    console.log(JSON.stringify(outcome.reports)); process.exitCode = outcome.exitCode;
  `;
  try {
    const child = Bun.spawn([process.execPath, "-e", supervisor], {
      cwd: root,
      env: { ...process.env, HARNESS_OUTPUT_DIRECTORY: output },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [status, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()]);
    expect(status).toBe(7);
    expect(JSON.parse(stdout.trim())).toMatchObject([{ passed: false }]);
    expect(JSON.parse(await readFile(join(output, "summary.json"), "utf8"))).toMatchObject({
      passed: false,
      driverExitCode: 7,
      games: [{ gameId: 1, botCount: 2000 }],
    });
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

it.each(["throw", "code"])(
  "a real roster worker's late exit listener (%s) has no successful publication",
  async (kind) => {
    const output = await mkdtemp(join(tmpdir(), "harness-worker-terminal-"));
    const source = await mkdtemp(join(tmpdir(), "harness-worker-source-"));
    const script = join(source, "worker.ts");
    const terminal = join(import.meta.dir, "terminal-report.ts");
    await writeFile(
      script,
      `
    import {sendPreparedReport} from ${JSON.stringify(terminal)};
    import {catchUncaughtFailures} from ${JSON.stringify(join(import.meta.dir, "worker-boundary.ts"))};
    catchUncaughtFailures();
    await sendPreparedReport({path: ${JSON.stringify(join(output, "worker.json"))}, workloadPassed: true,
      report: {workload: {plannedActions: 123}, thresholds: {checks: {}}}});
    process.on("exit", () => { ${kind === "throw" ? 'throw new Error("late worker exit")' : "process.exitCode = 7"}; });
  `,
    );
    const supervisor = `
    import {Worker} from "node:worker_threads";
    import {observeHarnessWorker} from ${JSON.stringify(terminal)};
    const result = await observeHarnessWorker(new Worker(${JSON.stringify(script)}), () => {});
    console.log(JSON.stringify(result.reports)); process.exitCode = result.exitCode || (result.reports.every(report => report.passed) ? 0 : 1);
  `;
    try {
      const child = Bun.spawn([process.execPath, "-e", supervisor], { cwd: root, stdout: "pipe", stderr: "pipe" });
      const [status, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()]);
      expect(status).toBe(kind === "throw" ? 1 : 7);
      expect(JSON.parse(stdout.trim())).toMatchObject([{ passed: false }]);
      expect(JSON.parse(await readFile(join(output, "worker.json"), "utf8"))).toMatchObject({
        passed: false,
        driverExitCode: kind === "throw" ? 1 : 7,
        workload: { plannedActions: 123 },
        thresholds: { checks: kind === "throw" ? { noUncaughtFailures: false } : { cleanProcessExit: false } },
      });
    } finally {
      await rm(output, { recursive: true, force: true });
      await rm(source, { recursive: true, force: true });
    }
  },
);
