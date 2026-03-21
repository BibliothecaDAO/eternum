import { env } from "../../../../../env";
import type { FactoryBlitzRegistrationOverrides, FactoryMapConfigOverrides } from "@bibliothecadao/types";

export type FactoryWorkerEnvironmentId = "slot.eternum" | "mainnet.eternum" | "slot.blitz" | "mainnet.blitz";
export type FactoryWorkerLaunchStepId =
  | "create-world"
  | "wait-for-factory-index"
  | "configure-world"
  | "grant-lootchest-role"
  | "grant-village-pass-role"
  | "create-banks"
  | "create-indexer"
  | "sync-paymaster";
export type FactoryWorkerLaunchScope = "full" | FactoryWorkerLaunchStepId;
export type FactoryWorkerRunStatus = "running" | "attention" | "complete";
export type FactoryWorkerRunStepStatus = "pending" | "running" | "succeeded" | "failed";

export interface FactoryWorkerRunRecord {
  version: 1;
  runId: string;
  environment: FactoryWorkerEnvironmentId;
  chain: "slot" | "mainnet";
  gameType: "eternum" | "blitz";
  gameName: string;
  status: FactoryWorkerRunStatus;
  executionMode: "fast_trial" | "guided_recovery";
  requestedLaunchStep: FactoryWorkerLaunchScope;
  inputPath: string;
  latestLaunchRequestId: string;
  currentStepId: FactoryWorkerLaunchStepId | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  activeLease?: {
    launchRequestId: string;
    workflowRunId?: number;
    workflowRunAttempt?: number;
    stepId: FactoryWorkerLaunchStepId;
    acquiredAt: string;
    expiresAt: string;
  };
  workflow: {
    workflowName: string;
    workflowJob?: string;
    workflowRunId?: number;
    workflowRunAttempt?: number;
    workflowUrl?: string;
    ref?: string;
    sha?: string;
  };
  steps: Array<{
    id: FactoryWorkerLaunchStepId;
    title: string;
    status: FactoryWorkerRunStepStatus;
    workflowStepName: string;
    latestEvent: string;
    startedAt?: string;
    finishedAt?: string;
    errorMessage?: string;
  }>;
  artifacts: {
    summaryPath?: string;
    worldAddress?: string;
    createGameTxHash?: string;
    configureTxHash?: string;
    lootChestRoleTxHash?: string;
    villagePassRoleTxHash?: string;
    createBanksTxHash?: string;
    paymasterSynced?: boolean;
    indexerCreated?: boolean;
  };
}

interface FactoryWorkerRunListResponse {
  runs: FactoryWorkerRunRecord[];
}

export interface CreateFactoryRunRequest {
  environment: FactoryWorkerEnvironmentId;
  gameName: string;
  gameStartTime: string;
  devModeOn?: boolean;
  twoPlayerMode?: boolean;
  singleRealmMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
}

interface ContinueFactoryRunRequest {
  environment: FactoryWorkerEnvironmentId;
  gameName: string;
  launchStep: FactoryWorkerLaunchScope;
}

const FACTORY_WORKER_BASE_URL = env.VITE_PUBLIC_FACTORY_WORKER_URL.replace(/\/$/, "");

const SUPPORTED_FACTORY_WORKER_ENVIRONMENTS = new Set<FactoryWorkerEnvironmentId>([
  "slot.eternum",
  "mainnet.eternum",
  "slot.blitz",
  "mainnet.blitz",
]);

export class FactoryWorkerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = "FactoryWorkerApiError";
  }
}

export const isFactoryWorkerEnvironmentSupported = (
  environmentId: string,
): environmentId is FactoryWorkerEnvironmentId =>
  SUPPORTED_FACTORY_WORKER_ENVIRONMENTS.has(environmentId as FactoryWorkerEnvironmentId);

export async function listFactoryRuns(
  environment: FactoryWorkerEnvironmentId,
): Promise<FactoryWorkerRunRecord[] | null> {
  try {
    const response = await fetchFactoryWorkerJson<FactoryWorkerRunListResponse>("/api/factory/runs", {
      query: { environment },
    });

    return response.runs;
  } catch (error) {
    if (isMissingListEndpoint(error)) {
      return null;
    }

    throw error;
  }
}

export async function readFactoryRun(
  environment: FactoryWorkerEnvironmentId,
  gameName: string,
): Promise<FactoryWorkerRunRecord> {
  return fetchFactoryWorkerJson<FactoryWorkerRunRecord>(buildFactoryRunPath(environment, gameName));
}

export async function readFactoryRunIfPresent(
  environment: FactoryWorkerEnvironmentId,
  gameName: string,
): Promise<FactoryWorkerRunRecord | null> {
  try {
    return await readFactoryRun(environment, gameName);
  } catch (error) {
    if (error instanceof FactoryWorkerApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function createFactoryRun(request: CreateFactoryRunRequest): Promise<void> {
  await fetchFactoryWorkerJson("/api/factory/runs", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function continueFactoryRun(request: ContinueFactoryRunRequest): Promise<void> {
  await fetchFactoryWorkerJson(`${buildFactoryRunPath(request.environment, request.gameName)}/actions/continue`, {
    method: "POST",
    body: JSON.stringify({ launchStep: request.launchStep }),
  });
}

function buildFactoryRunPath(environment: FactoryWorkerEnvironmentId, gameName: string) {
  return `/api/factory/runs/${encodeURIComponent(environment)}/${encodeURIComponent(gameName)}`;
}

function isMissingListEndpoint(error: unknown) {
  return error instanceof FactoryWorkerApiError && (error.status === 404 || error.status === 405);
}

async function fetchFactoryWorkerJson<ResponseBody>(
  pathname: string,
  options: {
    method?: "GET" | "POST";
    query?: Record<string, string | undefined>;
    body?: string;
  } = {},
): Promise<ResponseBody> {
  const response = await fetch(buildFactoryWorkerUrl(pathname, options.query), {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body,
  });

  const payload = await readFactoryWorkerPayload(response);

  if (!response.ok) {
    throw new FactoryWorkerApiError(
      resolveFactoryWorkerErrorMessage(payload, response.status),
      response.status,
      payload,
    );
  }

  return payload as ResponseBody;
}

function buildFactoryWorkerUrl(pathname: string, query?: Record<string, string | undefined>) {
  const url = new URL(`${FACTORY_WORKER_BASE_URL}${pathname}`);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function readFactoryWorkerPayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function resolveFactoryWorkerErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return `Factory worker request failed (${status})`;
}
