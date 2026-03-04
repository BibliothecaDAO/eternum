import { homedir } from "node:os";
import path from "node:path";

function expandTilde(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return path.join(homedir(), input.slice(2));
  return input;
}

function resolveAgentHome(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.ETERNUM_AGENT_HOME?.trim();
  if (configured) {
    return path.resolve(expandTilde(configured));
  }
  return path.join(homedir(), ".eternum-agent");
}

export function resolveDefaultDataDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveAgentHome(env), "data");
}

export function resolveDefaultSessionBasePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveAgentHome(env), ".cartridge");
}
