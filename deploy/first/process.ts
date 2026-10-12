import { PublicError, failureLog } from "./errors";
import { spawn } from "node:child_process";
import { root } from "./settings";

export interface Command {
  argv: string[];
  cwd?: string;
  input?: string | Uint8Array;
  env?: Record<string, string>;
}
export class CommandFailure extends Error {
  constructor(
    readonly stdout: string,
    readonly log?: string,
  ) {
    super("Deployment subprocess failed; no captured output was printed");
    this.name = "command_failed";
  }
}
/** Capture subprocess output: a failing SDK or CLI may echo its input. Only the caller's fixed label escapes. */
export async function command(spec: Command): Promise<string> {
  const env: Record<string, string> = {
    CI: "true",
    NO_COLOR: "1",
    WRANGLER_SEND_METRICS: "false",
    WRANGLER_LOG: "error",
  };
  for (const key of ["PATH", "HOME", "SSH_AUTH_SOCK", "LANG"]) if (process.env[key]) env[key] = process.env[key]!;
  Object.assign(env, spec.env);
  return new Promise((resolve, reject) => {
    const child = spawn(spec.argv[0]!, spec.argv.slice(1), {
      cwd: spec.cwd ?? root,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.on("error", () =>
      reject(new PublicError("Deployment subprocess could not start", null, "command_start_failed")),
    );
    child.on("close", (code) => {
      const stdout = Buffer.concat(chunks).toString();
      if (code === 0) return resolve(stdout);
      const log = failureLog(privateCommandOutput(spec, stdout + Buffer.concat(errors).toString()));
      reject(new CommandFailure(stdout, log));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(spec.input);
  });
}
export function shell(value: string) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

function privateCommandOutput(spec: Command, output: string): string {
  const values = Object.values(spec.env ?? {});
  if (spec.input) {
    const input = typeof spec.input === "string" ? spec.input : Buffer.from(spec.input).toString();
    values.push(input);
    try {
      const collect = (value: unknown): void => {
        if (typeof value === "string") values.push(value);
        else if (value && typeof value === "object") Object.values(value).forEach(collect);
      };
      collect(JSON.parse(input));
    } catch {
      // A line-based secret upload has no JSON object to traverse.
      values.push(...input.split("\n"));
    }
  }
  for (const value of values.filter(Boolean).sort((a, b) => b.length - a.length))
    output = output.replaceAll(value, "[redacted]");
  return output;
}
