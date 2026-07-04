import { spawnSync, type SpawnSyncReturns } from "node:child_process";

const AWS_COMMAND_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

export type AwsCommandRunner = (args: string[]) => SpawnSyncReturns<string>;
export type AwsCommandTag = { key: string; value: string };

export function runAwsCommand(args: string[]): SpawnSyncReturns<string> {
  return spawnSync("aws", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: AWS_COMMAND_MAX_BUFFER_BYTES,
    env: process.env,
  });
}

export function runRequiredAwsCommand(
  commandRunner: AwsCommandRunner,
  action: string,
  args: string[],
): SpawnSyncReturns<string> {
  const result = commandRunner(args);
  if ((result.status ?? 1) !== 0) {
    throw new Error(buildAwsCommandFailureMessage(action, result));
  }

  return result;
}

export function runOptionalAwsCleanupCommand(
  commandRunner: AwsCommandRunner,
  action: string,
  args: string[],
): SpawnSyncReturns<string> {
  const result = commandRunner(args);
  if ((result.status ?? 1) === 0) {
    return result;
  }

  const output = buildAwsCommandOutput(result);
  if (isMissingAwsCleanupOutput(output)) {
    return result;
  }

  throw new Error(buildAwsCommandFailureMessage(action, result));
}

export function commandOutputText(result: SpawnSyncReturns<string>): string {
  return normalizeCapturedOutput(result.stdout);
}

export function buildAwsCommandOutput(result: Pick<SpawnSyncReturns<string>, "stdout" | "stderr">): string {
  return [normalizeCapturedOutput(result.stderr), normalizeCapturedOutput(result.stdout)].filter(Boolean).join("\n");
}

export function parseJsonOutput<T>(output: string, fallback: T): T {
  const normalizedOutput = normalizeCapturedOutput(output);
  if (!normalizedOutput) {
    return fallback;
  }

  return JSON.parse(normalizedOutput) as T;
}

export function isMissingAwsServiceOutput(output: string): boolean {
  return /MISSING|ServiceNotFound|not found/i.test(output);
}

export function isMissingAwsCleanupOutput(output: string): boolean {
  return /MISSING|NotFound|not found|does not exist|not exist/i.test(output);
}

export function isPriorityInUseOutput(output: string): boolean {
  return /PriorityInUse/i.test(output);
}

function normalizeCapturedOutput(output: string | null | undefined): string {
  return `${output || ""}`.trim();
}

export function buildAwsCommandFailureMessage(action: string, result: SpawnSyncReturns<string>): string {
  if (result.error) {
    return `Failed to ${action}: ${result.error.message}`;
  }

  const exitCode = result.status ?? 1;
  const output = buildAwsCommandOutput(result);
  return output ? `Failed to ${action}: ${output}` : `Failed to ${action}: aws exited with code ${exitCode}`;
}
