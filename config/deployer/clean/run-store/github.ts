import { DEFAULT_FACTORY_RUN_STORE_BRANCH } from "../constants";
import {
  buildGitHubHeaders,
  readErrorBody,
  resolveGitHubRepositoryContext,
  type GitHubRepositoryContext,
  type ResolveGitHubRepositoryContextOptions,
} from "../shared/github";

interface GitHubBranchStoreConfig extends GitHubRepositoryContext {
  branch: string;
  baseSha: string;
}

interface GitHubContentsResponse {
  sha: string;
  content?: string;
  encoding?: string;
}

interface GitHubRefResponse {
  object?: {
    sha?: string;
  };
}

interface GitHubWriteBranchFileRequest {
  path: string;
  value: unknown;
  message: string;
}

export interface ResolveGitHubBranchStoreConfigOptions extends ResolveGitHubRepositoryContextOptions {
  branch?: string;
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function readBranchRefSha(config: GitHubBranchStoreConfig, branch: string): Promise<string | null> {
  const response = await fetch(`${config.apiBaseUrl}/repos/${config.repo}/git/ref/heads/${branch}`, {
    headers: buildGitHubHeaders(config.token),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Failed to read branch "${branch}": ${response.status} ${body}`);
  }

  const payload = await parseJson<GitHubRefResponse>(response);
  return payload.object?.sha || null;
}

async function createBranch(config: GitHubBranchStoreConfig): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/repos/${config.repo}/git/refs`, {
    method: "POST",
    headers: buildGitHubHeaders(config.token),
    body: JSON.stringify({
      ref: `refs/heads/${config.branch}`,
      sha: config.baseSha,
    }),
  });

  if (response.status === 422) {
    return;
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Failed to create branch "${config.branch}": ${response.status} ${body}`);
  }
}

export async function ensureGitHubBranchExists(config: GitHubBranchStoreConfig): Promise<void> {
  const branchSha = await readBranchRefSha(config, config.branch);
  if (branchSha) {
    return;
  }

  await createBranch(config);
}

export async function readGitHubBranchJsonFile<T>(
  config: GitHubBranchStoreConfig,
  path: string,
): Promise<{ sha?: string; value?: T }> {
  const response = await fetch(`${config.apiBaseUrl}/repos/${config.repo}/contents/${path}?ref=${config.branch}`, {
    headers: buildGitHubHeaders(config.token),
  });

  if (response.status === 404) {
    return {};
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Failed to read run-store file "${path}": ${response.status} ${body}`);
  }

  const payload = await parseJson<GitHubContentsResponse>(response);
  const rawContent = payload.encoding === "base64" ? Buffer.from(payload.content || "", "base64").toString("utf8") : "";

  return {
    sha: payload.sha,
    value: rawContent ? (JSON.parse(rawContent) as T) : undefined,
  };
}

async function tryWriteBranchFile(
  config: GitHubBranchStoreConfig,
  request: GitHubWriteBranchFileRequest,
  sha?: string,
): Promise<boolean> {
  const response = await fetch(`${config.apiBaseUrl}/repos/${config.repo}/contents/${request.path}`, {
    method: "PUT",
    headers: buildGitHubHeaders(config.token),
    body: JSON.stringify({
      branch: config.branch,
      message: request.message,
      content: Buffer.from(`${JSON.stringify(request.value, null, 2)}\n`, "utf8").toString("base64"),
      sha,
    }),
  });

  if (response.ok) {
    return true;
  }

  if (response.status === 409 || response.status === 422) {
    return false;
  }

  const body = await readErrorBody(response);
  throw new Error(`Failed to write run-store file "${request.path}": ${response.status} ${body}`);
}

export async function updateGitHubBranchJsonFile<T>(
  config: GitHubBranchStoreConfig,
  path: string,
  buildValue: (currentValue?: T) => T,
  message: string,
): Promise<T> {
  await ensureGitHubBranchExists(config);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await readGitHubBranchJsonFile<T>(config, path);
    const nextValue = buildValue(current.value);
    const didWrite = await tryWriteBranchFile(
      config,
      {
        path,
        value: nextValue,
        message,
      },
      current.sha,
    );

    if (didWrite) {
      return nextValue;
    }
  }

  throw new Error(`Failed to update run-store file "${path}" after 3 attempts`);
}

export function requireGitHubBranchStoreConfig(
  options: ResolveGitHubBranchStoreConfigOptions = {},
): GitHubBranchStoreConfig {
  const repositoryContext = resolveGitHubRepositoryContext(options);
  if (!repositoryContext) {
    throw new Error(
      "Factory run store requires direct GitHub access. Set GITHUB_TOKEN and GITHUB_REPOSITORY, or authenticate gh locally.",
    );
  }

  const baseSha = process.env.GITHUB_SHA;
  if (!baseSha) {
    throw new Error("Factory run store requires GITHUB_SHA so the storage branch can be created cleanly");
  }

  return {
    ...repositoryContext,
    branch: options.branch || process.env.FACTORY_RUN_STORE_BRANCH || DEFAULT_FACTORY_RUN_STORE_BRANCH,
    baseSha,
  };
}
