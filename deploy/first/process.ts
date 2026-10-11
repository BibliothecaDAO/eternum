import { spawn } from "node:child_process";
import { root } from "./settings";

export interface Command {
  argv: string[];
  cwd?: string;
  input?: string | Uint8Array;
  env?: Record<string, string>;
}
export class CommandFailure extends Error {
  constructor(readonly stdout: string) {
    super("Deployment subprocess failed; no captured output was printed");
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
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", () => {});
    child.on("error", () => reject(new Error("Deployment subprocess could not start")));
    child.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks).toString())
        : reject(new CommandFailure(Buffer.concat(chunks).toString())),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(spec.input);
  });
}
export function shell(value: string) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
