import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parentPort, type Worker } from "node:worker_threads";
import type { WorkerWorkloadSummary } from "./report";
import { retainBoundaryEvidence, type WorkerBoundaryEvidence } from "./worker-boundary";

/** Workload evidence is a candidate until its producing process or thread has actually exited. */
export interface PreparedTerminalReport {
  path: string;
  workloadPassed: boolean;
  report: Record<string, unknown> & {
    thresholds?: { checks: Record<string, boolean>; [key: string]: unknown };
    workload?: Record<string, unknown>;
    gates?: { passed: boolean; checks?: Record<string, boolean>; [key: string]: unknown };
  };
  workload?: WorkerWorkloadSummary;
}

interface TerminalReportResult {
  passed: boolean;
  path: string;
  workload?: WorkerWorkloadSummary;
}

interface Failure {
  kind: "failure" | "error";
  error: string;
  stack?: string;
}

export interface TerminalOutcome {
  exitCode: number;
  reports: TerminalReportResult[];
  failure?: Failure;
}

const emptyEvidence = (): WorkerBoundaryEvidence => ({
  uncaughtFailures: [],
});

/** Only evidence crosses this boundary. Children never write or announce a successful final verdict. */
export async function sendPreparedReport(prepared: PreparedTerminalReport): Promise<void> {
  if (!prepared.workloadPassed && !process.exitCode) process.exitCode = 1;
  retainBoundaryEvidence(`${prepared.path}.boundary`);
  const message = { type: "report-prepared", prepared };
  if (parentPort) return parentPort.postMessage(message);
  if (!process.send) throw new Error("Harness reports require an exit supervisor");
  await new Promise<void>((resolve, reject) => process.send!(message, (error) => (error ? reject(error) : resolve())));
}

/** The roster's existing worker boundary and the outer driver boundary share one evidence collector. */
function terminalEvidence() {
  const prepared = new Map<string, PreparedTerminalReport>();
  let boundary = emptyEvidence();
  let failure: Failure | undefined;
  return {
    accept(message: {
      type: string;
      prepared?: PreparedTerminalReport;
      evidence?: WorkerBoundaryEvidence;
      error?: string;
      stack?: string;
    }) {
      if (message.type === "report-prepared" && message.prepared) prepared.set(message.prepared.path, message.prepared);
      if (message.type === "boundary" && message.evidence) boundary = message.evidence;
      if (message.type === "failure")
        failure = { kind: "failure", error: message.error ?? "Worker failed", stack: message.stack };
    },
    error(error: Error) {
      failure = { kind: "error", error: error.message, stack: error.stack };
      boundary.uncaughtFailures.push({
        at: new Date().toISOString(),
        kind: "exception",
        error: error.message,
        stack: error.stack,
      });
    },
    finish(exitCode: number): TerminalOutcome {
      const reports = [...prepared.values()].map((candidate) => {
        const retained = JSON.parse(readFileSync(`${candidate.path}.boundary`, "utf8")) as WorkerBoundaryEvidence;
        const complete = {
          ...retained,
          uncaughtFailures: [
            ...retained.uncaughtFailures,
            ...boundary.uncaughtFailures.filter(
              (error) =>
                !retained.uncaughtFailures.some((saved) => saved.at === error.at && saved.error === error.error),
            ),
          ],
        };
        const report = commitTerminalReport(candidate, exitCode, complete);
        unlinkSync(`${candidate.path}.boundary`);
        return report;
      });
      return { exitCode, reports, ...(failure ? { failure } : {}) };
    },
  };
}

/** Finalize the individual game only after every exit listener of its worker has finished. */
export function observeHarnessWorker(worker: Worker, onReady: () => void): Promise<TerminalOutcome> {
  const evidence = terminalEvidence();
  return new Promise((resolve) => {
    worker.on("message", (message) => {
      if (message.type === "ready") onReady();
      else evidence.accept(message);
    });
    worker.once("error", (error) => evidence.error(error));
    worker.once("exit", (code) => resolve(evidence.finish(code)));
  });
}

/** A separate, idle process owns the standalone/roster driver's report after the driver's actual OS exit. */
export async function superviseHarnessProcess(
  command: string[],
  env: Record<string, string | undefined>,
): Promise<TerminalOutcome> {
  const evidence = terminalEvidence();
  const child = Bun.spawn(command, {
    env,
    stdout: "inherit",
    stderr: "inherit",
    ipc: (message) => evidence.accept(message),
  });
  const interrupt = () => child.kill("SIGINT");
  const terminate = () => child.kill("SIGTERM");
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    const code = await child.exited;
    const outcome = evidence.finish(code);
    if (outcome.reports.length === 0) {
      const output = env.HARNESS_OUTPUT_DIRECTORY;
      if (!output) throw new Error("Harness supervisor requires its report directory");
      outcome.reports.push(
        commitTerminalReport(
          {
            path: path.join(output, "failure.json"),
            workloadPassed: false,
            report: {
              error: outcome.failure?.error ?? `Harness driver exited ${code} without report evidence`,
              stack: outcome.failure?.stack,
            },
          },
          code,
          emptyEvidence(),
        ),
      );
    }
    return {
      ...outcome,
      exitCode: code || (outcome.reports.some((report) => !report.passed) || outcome.failure ? 1 : 0),
    };
  } finally {
    const removeListener = process.removeListener as (event: string, listener: () => void) => void;
    removeListener.call(process, "SIGINT", interrupt);
    removeListener.call(process, "SIGTERM", terminate);
  }
}

function commitTerminalReport(
  candidate: PreparedTerminalReport,
  exitCode: number,
  boundary: WorkerBoundaryEvidence,
): TerminalReportResult {
  const passed = candidate.workloadPassed && exitCode === 0 && boundary.uncaughtFailures.length === 0;
  const report = { ...candidate.report, passed, driverExitCode: exitCode, workerBoundary: boundary };
  if (report.thresholds)
    report.thresholds = {
      ...report.thresholds,
      checks: {
        ...report.thresholds.checks,
        cleanProcessExit: exitCode === 0,
        noUncaughtFailures: boundary.uncaughtFailures.length === 0,
      },
    };
  if (report.gates)
    report.gates = {
      ...report.gates,
      passed: report.gates.passed && passed,
      checks: {
        ...report.gates.checks,
        cleanProcessExit: exitCode === 0,
        noUncaughtFailures: boundary.uncaughtFailures.length === 0,
      },
    };
  if (report.workload) report.workload = { ...report.workload, ...boundary };
  mkdirSync(path.dirname(candidate.path), { recursive: true });
  const pendingPath = `${candidate.path}.pending`;
  writeFileSync(pendingPath, `${JSON.stringify(report, null, 2)}\n`);
  renameSync(pendingPath, candidate.path);
  return { passed, path: candidate.path, ...(candidate.workload ? { workload: candidate.workload } : {}) };
}
