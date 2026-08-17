import { mkdir } from "node:fs/promises";
import path from "node:path";

export type CliArgs = Record<string, string | boolean>;

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      throw new Error(`Unexpected positional argument "${token}"`);
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    if (!rawKey) {
      throw new Error("Empty option name");
    }

    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];
    if (nextToken && !nextToken.startsWith("--")) {
      args[rawKey] = nextToken;
      index += 1;
      continue;
    }

    args[rawKey] = true;
  }

  return args;
}

export function optionalString(args: CliArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function requireString(args: CliArgs, key: string): string {
  const value = optionalString(args, key);
  if (!value) {
    throw new Error(`--${key} is required`);
  }
  return value;
}

export function optionalInteger(args: CliArgs, key: string): number | undefined {
  const value = optionalString(args, key);
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`--${key} must be a safe integer`);
  }
  return parsed;
}

export function requirePositiveInteger(args: CliArgs, key: string): number {
  const value = optionalInteger(args, key);
  if (value === undefined || value <= 0) {
    throw new Error(`--${key} must be a positive integer`);
  }
  return value;
}

export function hasFlag(args: CliArgs, key: string): boolean {
  const value = args[key];
  if (value === undefined || value === false || value === "false") {
    return false;
  }
  if (value === true || value === "true") {
    return true;
  }
  throw new Error(`--${key} must be a boolean flag`);
}

export async function writeJsonReport(report: unknown, outputPath?: string): Promise<void> {
  const json = `${JSON.stringify(report, null, 2)}\n`;
  process.stdout.write(json);

  if (!outputPath) {
    return;
  }

  const resolvedPath = path.resolve(outputPath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await Bun.write(resolvedPath, json);
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
