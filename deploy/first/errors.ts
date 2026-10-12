import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let currentStage = "arguments";
export function deploymentStage(name: string) {
  currentStage = name;
}
export class PublicError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly code = "precondition_failed",
    readonly stage = currentStage,
    readonly log?: string,
  ) {
    super(message);
  }
}
export function reportFailure(error: unknown): void {
  const failure = error instanceof PublicError ? error : undefined;
  const log =
    error && typeof error === "object" && "log" in error && typeof error.log === "string"
      ? error.log
      : join(mkdtempSync(join(tmpdir(), "realms-deploy-")), "failure.log");
  const message = failure?.message ?? "Unexpected failure; inspect the command log";
  const line = `Deployment stopped at ${failure?.stage ?? currentStage}; HTTP ${failure?.status ?? "n/a"}; code ${failure?.code ?? (error instanceof Error ? error.name : "unknown")}: ${message}; log: ${log}`;
  if (!(error && typeof error === "object" && "log" in error && typeof error.log === "string"))
    writeFileSync(log, line + "\n", { mode: 0o600 });
  console.error(line);
  process.exitCode = 1;
}
