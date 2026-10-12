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
/** Diagnostics must not replace the original failure when private storage is unavailable. */
export function failureLog(detail: string): string | undefined {
  try {
    const log = join(mkdtempSync(join(tmpdir(), "realms-deploy-")), "failure.log");
    writeFileSync(log, detail, { mode: 0o600 });
    return log;
  } catch {
    return undefined;
  }
}
export function reportFailure(error: unknown): void {
  const failure = error instanceof PublicError ? error : undefined;
  const message = failure?.message ?? "Subprocess or SDK failure";
  const line = `Deployment stopped at ${failure?.stage ?? currentStage}; HTTP ${failure?.status ?? "n/a"}; code ${failure?.code ?? (error instanceof Error ? error.name : "unknown")}: ${message}`;
  const existingLog =
    error && typeof error === "object" && "log" in error && typeof error.log === "string" ? error.log : undefined;
  const log = existingLog ?? failureLog(line + "\n");
  console.error(`${line}; log: ${log ?? "unavailable (private log could not be written)"}`);
  process.exitCode = 1;
}
