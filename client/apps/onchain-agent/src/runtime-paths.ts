import { homedir } from "node:os";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

function isBunBinaryRuntime(): boolean {
  return import.meta.url.includes("$bunfs") || import.meta.url.includes("~BUN") || import.meta.url.includes("%7EBUN");
}

function expandTilde(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return path.join(homedir(), input.slice(2));
  return input;
}

function resolvePackageRootFromModule(): string {
  return fileURLToPath(new URL("..", import.meta.url));
}

function resolvePackageRoot(): string {
  if (isBunBinaryRuntime()) {
    return dirname(process.execPath);
  }
  return resolvePackageRootFromModule();
}

export function resolveBundledPath(...segments: string[]): string {
  return path.join(resolvePackageRoot(), ...segments);
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
