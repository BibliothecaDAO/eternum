import {
  DEFAULT_INDEXER_WORKFLOW_POLL_MS,
  DEFAULT_INDEXER_WORKFLOW_TIMEOUT_MS,
  DEFAULT_TORII_WORKFLOW_FILE,
} from "../constants";
import { buildGitHubHeaders, readErrorBody, resolveGitHubRepositoryContext, runCommand } from "../shared/github";
import type { IndexerCreationResult, IndexerRequest, IndexerWorkflowRun } from "../types";

interface CreateIndexerOptions {
  onProgress?: (message: string) => void;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  commandRunner?: (command: string, args: string[]) => string | null;
}

interface GitHubWorkflowDispatchConfig {
  token: string;
  repo: string;
  apiBaseUrl: string;
  ref: string;
  workflowFile: string;
  sha?: string;
  timeoutMs: number;
  pollIntervalMs: number;
}

interface WorkflowExecutionDependencies {
  fetchImpl: typeof fetch;
  wait: (ms: number) => Promise<void>;
  onProgress?: (message: string) => void;
}

interface GitHubWorkflowRunResponse {
  id: number;
  run_number: number;
  html_url: string;
  status: string;
  conclusion: string | null;
  event: string;
  head_branch: string;
  head_sha: string;
  created_at: string;
  display_title?: string;
  name?: string;
}

interface GitHubWorkflowRunsResponse {
  workflow_runs?: GitHubWorkflowRunResponse[];
}

interface WorkflowDispatchAttemptResult {
  ok: boolean;
  dispatchStartedAtMs: number;
  status: number;
  statusText: string;
  body: string;
  retryAfterMs: number | null;
}

const TRANSIENT_WORKFLOW_DISPATCH_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_WORKFLOW_DISPATCH_ATTEMPTS = 3;
const BASE_WORKFLOW_DISPATCH_RETRY_DELAY_MS = 1_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRefName(ref: string | undefined): string | undefined {
  if (!ref) {
    return undefined;
  }

  if (ref.startsWith("refs/heads/")) {
    return ref.slice("refs/heads/".length);
  }

  if (ref.startsWith("refs/tags/")) {
    return ref.slice("refs/tags/".length);
  }

  return ref;
}

function resolveGitReference(
  request: IndexerRequest,
  onProgress: ((message: string) => void) | undefined,
  commandRunner: (command: string, args: string[]) => string | null,
): string | undefined {
  const explicitRef = request.ref || process.env.GITHUB_REF_NAME || extractRefName(process.env.GITHUB_REF);
  if (explicitRef) {
    return explicitRef;
  }

  if (process.env.GITHUB_ACTIONS === "true") {
    return undefined;
  }

  const gitBranch = commandRunner("git", ["branch", "--show-current"]);
  if (gitBranch && gitBranch !== "HEAD") {
    onProgress?.("Using current git branch as workflow ref because no explicit ref was provided");
    return gitBranch;
  }

  return undefined;
}

function resolveGitHubWorkflowDispatchConfig(
  request: IndexerRequest,
  options: Pick<CreateIndexerOptions, "onProgress" | "commandRunner">,
): GitHubWorkflowDispatchConfig | null {
  const commandRunner = options.commandRunner || runCommand;
  const repositoryContext = resolveGitHubRepositoryContext({
    onProgress: options.onProgress,
    commandRunner,
  });
  const ref = resolveGitReference(request, options.onProgress, commandRunner);

  if (!repositoryContext || !ref) {
    return null;
  }

  return {
    ...repositoryContext,
    ref,
    workflowFile: request.workflowFile || DEFAULT_TORII_WORKFLOW_FILE,
    sha: process.env.GITHUB_SHA,
    timeoutMs: DEFAULT_INDEXER_WORKFLOW_TIMEOUT_MS,
    pollIntervalMs: DEFAULT_INDEXER_WORKFLOW_POLL_MS,
  };
}

function requireGitHubWorkflowDispatchConfig(
  request: IndexerRequest,
  options: Pick<CreateIndexerOptions, "onProgress" | "commandRunner">,
): GitHubWorkflowDispatchConfig {
  const githubConfig = resolveGitHubWorkflowDispatchConfig(request, options);
  if (!githubConfig) {
    throw new Error(
      "Indexer creation requires direct GitHub workflow dispatch. Set GITHUB_TOKEN and GITHUB_REPOSITORY, and provide a ref via --ref or GITHUB_REF_NAME when not running inside GitHub Actions.",
    );
  }

  return githubConfig;
}

function resolveWorkflowExecutionDependencies(options: CreateIndexerOptions): WorkflowExecutionDependencies {
  return {
    fetchImpl: options.fetchImpl || fetch,
    wait: options.sleep || sleep,
    onProgress: options.onProgress,
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function buildWorkflowDispatchBody(request: IndexerRequest, dispatchId: string, ref: string) {
  return JSON.stringify({
    ref,
    inputs: {
      operation: "deploy",
      env: request.env,
      torii_prefix: request.worldName,
      torii_name: request.worldName,
      torii_tier: request.tier || "basic",
      rpc_url: request.rpcUrl,
      torii_world_address: request.worldAddress,
      torii_namespaces: request.namespaces,
      torii_external_contracts: (request.externalContracts || []).join("\n"),
      launch_request_id: dispatchId,
    },
  });
}

function parseRetryAfterHeader(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const timestampMs = Date.parse(value);
  if (!Number.isFinite(timestampMs)) {
    return null;
  }

  return Math.max(0, timestampMs - Date.now());
}

function isTransientWorkflowDispatchFailure(status: number): boolean {
  return TRANSIENT_WORKFLOW_DISPATCH_STATUSES.has(status);
}

function resolveWorkflowDispatchRetryDelayMs(attempt: number, retryAfterMs: number | null): number {
  if (retryAfterMs !== null) {
    return retryAfterMs;
  }

  return BASE_WORKFLOW_DISPATCH_RETRY_DELAY_MS * attempt;
}

function buildWorkflowDispatchFailureMessage(
  workflowFile: string,
  attempt: Pick<WorkflowDispatchAttemptResult, "status" | "statusText" | "body">,
): string {
  return `Failed to dispatch ${workflowFile}: ${attempt.status} ${attempt.statusText}${
    attempt.body ? ` - ${attempt.body}` : ""
  }`;
}

function matchesDispatch(
  run: GitHubWorkflowRunResponse,
  dispatchId: string,
  dispatchStartedAtMs: number,
  config: Pick<GitHubWorkflowDispatchConfig, "ref" | "sha">,
): boolean {
  if (run.event !== "workflow_dispatch") {
    return false;
  }

  if (run.head_branch !== config.ref) {
    return false;
  }

  if (config.sha && run.head_sha && run.head_sha !== config.sha) {
    return false;
  }

  if (Date.parse(run.created_at) < dispatchStartedAtMs - 60_000) {
    return false;
  }

  const displayTitle = `${run.display_title || ""} ${run.name || ""}`;
  return displayTitle.includes(dispatchId);
}

function toWorkflowRun(
  run: GitHubWorkflowRunResponse,
  config: Pick<GitHubWorkflowDispatchConfig, "workflowFile" | "ref">,
): IndexerWorkflowRun {
  return {
    workflowFile: config.workflowFile,
    ref: config.ref,
    runId: run.id,
    runNumber: run.run_number,
    htmlUrl: run.html_url,
    status: run.status,
    conclusion: run.conclusion || "unknown",
  };
}

async function findWorkflowRun(
  config: GitHubWorkflowDispatchConfig,
  dispatchId: string,
  dispatchStartedAtMs: number,
  fetchImpl: typeof fetch,
): Promise<GitHubWorkflowRunResponse | null> {
  const params = new URLSearchParams();
  params.set("event", "workflow_dispatch");
  params.set("branch", config.ref);
  params.set("per_page", "20");

  const response = await fetchImpl(
    `${config.apiBaseUrl}/repos/${config.repo}/actions/workflows/${encodeURIComponent(config.workflowFile)}/runs?${params.toString()}`,
    {
      method: "GET",
      headers: buildGitHubHeaders(config.token),
    },
  );

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(
      `Failed to list workflow runs for ${config.workflowFile}: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`,
    );
  }

  const payload = await parseJson<GitHubWorkflowRunsResponse>(response);
  return payload.workflow_runs?.find((run) => matchesDispatch(run, dispatchId, dispatchStartedAtMs, config)) || null;
}

async function getWorkflowRun(
  config: GitHubWorkflowDispatchConfig,
  runId: number,
  fetchImpl: typeof fetch,
): Promise<GitHubWorkflowRunResponse> {
  const response = await fetchImpl(`${config.apiBaseUrl}/repos/${config.repo}/actions/runs/${runId}`, {
    method: "GET",
    headers: buildGitHubHeaders(config.token),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(
      `Failed to read workflow run ${runId}: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`,
    );
  }

  return parseJson<GitHubWorkflowRunResponse>(response);
}

async function postIndexerWorkflowDispatch(
  request: IndexerRequest,
  config: GitHubWorkflowDispatchConfig,
  dependencies: WorkflowExecutionDependencies,
  dispatchId: string,
): Promise<WorkflowDispatchAttemptResult> {
  const dispatchStartedAtMs = Date.now();
  const response = await dependencies.fetchImpl(
    `${config.apiBaseUrl}/repos/${config.repo}/actions/workflows/${encodeURIComponent(config.workflowFile)}/dispatches`,
    {
      method: "POST",
      headers: buildGitHubHeaders(config.token),
      body: buildWorkflowDispatchBody(request, dispatchId, config.ref),
    },
  );

  return {
    ok: response.ok,
    dispatchStartedAtMs,
    status: response.status,
    statusText: response.statusText,
    body: response.ok ? "" : await readErrorBody(response),
    retryAfterMs: parseRetryAfterHeader(response.headers.get("retry-after")),
  };
}

async function findWorkflowRunAfterDispatchFailure(
  config: GitHubWorkflowDispatchConfig,
  dependencies: WorkflowExecutionDependencies,
  dispatchId: string,
  dispatchStartedAtMs: number,
): Promise<boolean> {
  try {
    return (await findWorkflowRun(config, dispatchId, dispatchStartedAtMs, dependencies.fetchImpl)) !== null;
  } catch {
    return false;
  }
}

async function dispatchIndexerWorkflow(
  request: IndexerRequest,
  config: GitHubWorkflowDispatchConfig,
  dependencies: WorkflowExecutionDependencies,
  dispatchId: string,
): Promise<number> {
  dependencies.onProgress?.(`Dispatching ${config.workflowFile} on ref ${config.ref}`);

  let firstDispatchStartedAtMs: number | null = null;

  for (let attempt = 1; attempt <= MAX_WORKFLOW_DISPATCH_ATTEMPTS; attempt += 1) {
    const dispatchAttempt = await postIndexerWorkflowDispatch(request, config, dependencies, dispatchId);
    firstDispatchStartedAtMs ??= dispatchAttempt.dispatchStartedAtMs;

    if (dispatchAttempt.ok) {
      return firstDispatchStartedAtMs;
    }

    const failureMessage = buildWorkflowDispatchFailureMessage(config.workflowFile, dispatchAttempt);
    if (!isTransientWorkflowDispatchFailure(dispatchAttempt.status) || attempt === MAX_WORKFLOW_DISPATCH_ATTEMPTS) {
      throw new Error(failureMessage);
    }

    const delayMs = resolveWorkflowDispatchRetryDelayMs(attempt, dispatchAttempt.retryAfterMs);
    dependencies.onProgress?.(
      `${failureMessage}. Retrying in ${Math.ceil(delayMs / 1_000)}s (${attempt + 1}/${MAX_WORKFLOW_DISPATCH_ATTEMPTS})`,
    );
    await dependencies.wait(delayMs);

    if (await findWorkflowRunAfterDispatchFailure(config, dependencies, dispatchId, firstDispatchStartedAtMs)) {
      dependencies.onProgress?.(
        `Detected ${config.workflowFile} run after a transient dispatch failure; continuing with the existing workflow run`,
      );
      return firstDispatchStartedAtMs;
    }
  }

  throw new Error(`Failed to dispatch ${config.workflowFile}`);
}

async function waitForWorkflowRunToAppear(
  config: GitHubWorkflowDispatchConfig,
  dependencies: WorkflowExecutionDependencies,
  dispatchId: string,
  dispatchStartedAtMs: number,
): Promise<GitHubWorkflowRunResponse> {
  dependencies.onProgress?.(`Waiting for ${config.workflowFile} run to appear`);

  const deadlineAtMs = dispatchStartedAtMs + config.timeoutMs;
  let matchedRun = await findWorkflowRun(config, dispatchId, dispatchStartedAtMs, dependencies.fetchImpl);

  while (!matchedRun && Date.now() < deadlineAtMs) {
    await dependencies.wait(config.pollIntervalMs);
    matchedRun = await findWorkflowRun(config, dispatchId, dispatchStartedAtMs, dependencies.fetchImpl);
  }

  if (!matchedRun) {
    throw new Error(`Timed out waiting for ${config.workflowFile} run to start for dispatch ${dispatchId}`);
  }

  dependencies.onProgress?.(`Tracking ${config.workflowFile} run #${matchedRun.run_number}: ${matchedRun.html_url}`);
  return matchedRun;
}

function logWorkflowRunStateIfChanged(params: {
  onProgress?: (message: string) => void;
  workflowFile: string;
  currentRun: GitHubWorkflowRunResponse;
  previousState: string;
}): string {
  const currentState = `${params.currentRun.status}:${params.currentRun.conclusion || "pending"}`;
  if (currentState !== params.previousState) {
    params.onProgress?.(
      `${params.workflowFile} run #${params.currentRun.run_number} status: ${params.currentRun.status}${
        params.currentRun.conclusion ? ` (${params.currentRun.conclusion})` : ""
      }`,
    );
  }

  return currentState;
}

async function waitForWorkflowRunToComplete(
  config: GitHubWorkflowDispatchConfig,
  dependencies: WorkflowExecutionDependencies,
  matchedRun: GitHubWorkflowRunResponse,
  dispatchStartedAtMs: number,
): Promise<IndexerCreationResult> {
  const deadlineAtMs = dispatchStartedAtMs + config.timeoutMs;
  let lastState = "";

  while (Date.now() < deadlineAtMs) {
    const currentRun = await getWorkflowRun(config, matchedRun.id, dependencies.fetchImpl);
    lastState = logWorkflowRunStateIfChanged({
      onProgress: dependencies.onProgress,
      workflowFile: config.workflowFile,
      currentRun,
      previousState: lastState,
    });

    if (currentRun.status === "completed") {
      if (currentRun.conclusion !== "success") {
        throw new Error(
          `${config.workflowFile} run #${currentRun.run_number} failed with conclusion "${currentRun.conclusion || "unknown"}": ${currentRun.html_url}`,
        );
      }

      return {
        mode: "github-actions",
        workflowRun: toWorkflowRun(currentRun, config),
      };
    }

    await dependencies.wait(config.pollIntervalMs);
  }

  throw new Error(`Timed out waiting for ${config.workflowFile} run #${matchedRun.run_number} to complete`);
}

async function createIndexerViaGitHubActions(
  request: IndexerRequest,
  config: GitHubWorkflowDispatchConfig,
  options: CreateIndexerOptions,
): Promise<IndexerCreationResult> {
  const dependencies = resolveWorkflowExecutionDependencies(options);
  const dispatchId = crypto.randomUUID();
  const dispatchStartedAtMs = await dispatchIndexerWorkflow(request, config, dependencies, dispatchId);
  const matchedRun = await waitForWorkflowRunToAppear(config, dependencies, dispatchId, dispatchStartedAtMs);
  return waitForWorkflowRunToComplete(config, dependencies, matchedRun, dispatchStartedAtMs);
}

export async function createIndexer(
  request: IndexerRequest,
  options: CreateIndexerOptions = {},
): Promise<IndexerCreationResult> {
  const githubConfig = requireGitHubWorkflowDispatchConfig(request, options);
  return createIndexerViaGitHubActions(request, githubConfig, options);
}
