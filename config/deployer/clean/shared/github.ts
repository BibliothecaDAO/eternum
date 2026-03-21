import { spawnSync } from "node:child_process";

export const GITHUB_API_VERSION = "2022-11-28";

export interface GitHubRepositoryContext {
  token: string;
  repo: string;
  apiBaseUrl: string;
}

export interface ResolveGitHubRepositoryContextOptions {
  onProgress?: (message: string) => void;
  commandRunner?: (command: string, args: string[]) => string | null;
}

export function runCommand(command: string, args: string[]): string | null {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    return null;
  }

  const output = `${result.stdout || ""}`.trim();
  return output || null;
}

export function buildGitHubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

export async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim();
  } catch {
    return "";
  }
}

export function resolveGitHubToken(
  onProgress: ((message: string) => void) | undefined,
  commandRunner: (command: string, args: string[]) => string | null,
): string | undefined {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  if (process.env.GITHUB_ACTIONS === "true") {
    return undefined;
  }

  const token = commandRunner("gh", ["auth", "token"]);
  if (token) {
    onProgress?.("Using GitHub token from gh auth token because GITHUB_TOKEN is not set");
  }

  return token || undefined;
}

export function resolveGitHubRepository(
  onProgress: ((message: string) => void) | undefined,
  commandRunner: (command: string, args: string[]) => string | null,
): string | undefined {
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }

  if (process.env.GITHUB_ACTIONS === "true") {
    return undefined;
  }

  const repository = commandRunner("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  if (repository) {
    onProgress?.("Using GitHub repository from gh repo view because GITHUB_REPOSITORY is not set");
  }

  return repository || undefined;
}

export function resolveGitHubRepositoryContext(
  options: ResolveGitHubRepositoryContextOptions = {},
): GitHubRepositoryContext | null {
  const commandRunner = options.commandRunner || runCommand;
  const token = resolveGitHubToken(options.onProgress, commandRunner);
  const repo = resolveGitHubRepository(options.onProgress, commandRunner);

  if (!token || !repo) {
    return null;
  }

  return {
    token,
    repo,
    apiBaseUrl: process.env.GITHUB_API_URL || "https://api.github.com",
  };
}
