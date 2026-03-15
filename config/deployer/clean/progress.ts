interface StageMessages<Result> {
  start?: string;
  success?: string | ((result: Result, elapsedMs: number) => string);
  failure?: string | ((error: unknown, elapsedMs: number) => string);
}

type LogKind = "info" | "success" | "failure";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  red: "\u001b[31m",
} as const;

function supportsColor(): boolean {
  if (process.env.NO_COLOR) {
    return false;
  }

  return process.stderr.isTTY || process.env.CI === "true";
}

function colorize(text: string, ...codes: string[]): string {
  if (!supportsColor() || codes.length === 0) {
    return text;
  }

  return `${codes.join("")}${text}${ANSI.reset}`;
}

function formatLine(kind: LogKind, totalElapsedMs: number, message: string): string {
  const prefix = colorize(`[+${formatDuration(totalElapsedMs)}]`, ANSI.dim);
  const badge =
    kind === "success"
      ? colorize("OK", ANSI.bold, ANSI.green)
      : kind === "failure"
        ? colorize("ERR", ANSI.bold, ANSI.red)
        : colorize("INFO", ANSI.bold, ANSI.cyan);

  return `${prefix} ${badge} ${message}`;
}

function writeToStderr(line: string): void {
  // Progress stays on stderr so stdout can remain machine-readable JSON.
  process.stderr.write(`${line}\n`);
}

export function formatDuration(elapsedMs: number): string {
  if (elapsedMs < 1_000) {
    return `${elapsedMs}ms`;
  }

  if (elapsedMs < 60_000) {
    return `${(elapsedMs / 1_000).toFixed(1)}s`;
  }

  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function resolveStageMessage<Result>(
  message: string | ((value: Result, elapsedMs: number) => string) | undefined,
  fallback: string,
  value: Result,
  elapsedMs: number,
): string {
  if (!message) {
    return fallback;
  }

  return typeof message === "function" ? message(value, elapsedMs) : message;
}

export interface ProgressReporter {
  log: (message: string) => void;
  run: <Result>(label: string, operation: () => Promise<Result>, messages?: StageMessages<Result>) => Promise<Result>;
}

export function createProgressReporter(): ProgressReporter {
  const startedAt = Date.now();

  function write(kind: LogKind, message: string): void {
    // Prefix every line with total elapsed time to make CI logs easy to scan.
    const totalElapsedMs = Date.now() - startedAt;
    writeToStderr(formatLine(kind, totalElapsedMs, message));
  }

  function log(message: string): void {
    write("info", message);
  }

  return {
    log,
    async run<Result>(
      label: string,
      operation: () => Promise<Result>,
      messages?: StageMessages<Result>,
    ): Promise<Result> {
      const stageStartedAt = Date.now();
      write("info", messages?.start || label);

      try {
        const result = await operation();
        const elapsedMs = Date.now() - stageStartedAt;
        write(
          "success",
          resolveStageMessage(messages?.success, `${label} completed in ${formatDuration(elapsedMs)}`, result, elapsedMs),
        );
        return result;
      } catch (error) {
        const elapsedMs = Date.now() - stageStartedAt;
        const errorWithFallback = error instanceof Error ? error : new Error(String(error));
        write(
          "failure",
          resolveStageMessage(
            messages?.failure,
            `${label} failed after ${formatDuration(elapsedMs)}: ${errorWithFallback.message}`,
            error,
            elapsedMs,
          ),
        );
        throw error;
      }
    },
  };
}
