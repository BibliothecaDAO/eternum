import { env } from "../../../../../env";
import type { FactoryBlitzRegistrationOverrides, FactoryMapConfigOverrides } from "@bibliothecadao/types";

export type FactoryWorkerEnvironmentId = "slot.eternum" | "mainnet.eternum" | "slot.blitz" | "mainnet.blitz";
type FactoryWorkerRunKind = "game" | "series" | "rotation";
export type FactoryWorkerGameLaunchStepId =
  | "create-world"
  | "wait-for-factory-index"
  | "configure-world"
  | "grant-lootchest-role"
  | "grant-village-pass-role"
  | "create-banks"
  | "create-indexer"
  | "sync-paymaster";
export type FactoryWorkerSeriesLaunchStepId =
  | "create-series"
  | "create-worlds"
  | "wait-for-factory-indexes"
  | "configure-worlds"
  | "grant-lootchest-roles"
  | "grant-village-pass-roles"
  | "create-banks"
  | "create-indexers"
  | "sync-paymaster";
export type FactoryWorkerRotationLaunchStepId = FactoryWorkerSeriesLaunchStepId;
export type FactoryWorkerLaunchStepId = FactoryWorkerGameLaunchStepId | FactoryWorkerSeriesLaunchStepId;
export type FactoryWorkerGameLaunchScope = "full" | FactoryWorkerGameLaunchStepId;
export type FactoryWorkerSeriesLaunchScope = "full" | FactoryWorkerSeriesLaunchStepId;
export type FactoryWorkerRotationLaunchScope = "full" | FactoryWorkerRotationLaunchStepId;
type FactoryWorkerRunStatus = "running" | "attention" | "complete";
export type FactoryWorkerRunStepStatus = "pending" | "running" | "succeeded" | "failed";
export type FactoryWorkerRunRecoveryState = "active" | "transitioning" | "stalled" | "failed" | "complete";
export type FactoryWorkerIndexerTier = "basic" | "pro" | "legendary" | "epic";
const FACTORY_WORKER_ADMIN_SECRET_HEADER = "x-factory-admin-secret";

export interface FactoryWorkerLiveIndexerEntry {
  gameName: string;
  updatedAt: string;
  liveState: {
    state: "existing" | "missing" | "indeterminate";
    stateSource: "describe" | "describe-not-found" | "list" | "describe-and-list-failed";
    currentTier?: FactoryWorkerIndexerTier;
    url?: string;
    version?: string;
    branch?: string;
    describeError?: string;
    describedAt?: string;
  };
}

interface FactoryWorkerLiveIndexerResponse {
  updatedAt: string | null;
  entries: FactoryWorkerLiveIndexerEntry[];
}

export interface FactoryWorkerPrizeFundingTransfer {
  id: string;
  tokenAddress: string;
  amountRaw: string;
  amountDisplay: string;
  decimals: number;
  transactionHash: string;
  fundedAt: string;
}

export interface FactoryWorkerPrizeFundingState {
  transfers: FactoryWorkerPrizeFundingTransfer[];
}

export interface FactoryWorkerRunRecovery {
  state: FactoryWorkerRunRecoveryState;
  canContinue: boolean;
  continueStepId: FactoryWorkerLaunchStepId | null;
}

interface FactoryWorkerRunWorkflow {
  workflowName: string;
  workflowJob?: string;
  workflowRunId?: number;
  workflowRunAttempt?: number;
  workflowUrl?: string;
  ref?: string;
  sha?: string;
}

interface FactoryWorkerGameArtifacts {
  summaryPath?: string;
  durationSeconds?: number;
  worldAddress?: string;
  createGameTxHash?: string;
  configureTxHash?: string;
  lootChestRoleTxHash?: string;
  villagePassRoleTxHash?: string;
  createBanksTxHash?: string;
  paymasterSynced?: boolean;
  indexerCreated?: boolean;
  indexerTier?: FactoryWorkerIndexerTier;
  prizeFunding?: FactoryWorkerPrizeFundingState;
}

interface FactoryWorkerRotationEvaluation {
  intervalMinutes: number;
  nextEvaluationAt?: string;
  lastEvaluatedAt?: string;
  lastNudgedAt?: string;
}

interface FactoryWorkerBaseRunRecord {
  version: 1;
  environment: FactoryWorkerEnvironmentId;
  chain: "slot" | "mainnet";
  gameType: "eternum" | "blitz";
  status: FactoryWorkerRunStatus;
  executionMode: "fast_trial" | "guided_recovery";
  inputPath: string;
  latestLaunchRequestId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  workflow: FactoryWorkerRunWorkflow;
  recovery?: FactoryWorkerRunRecovery;
}

export interface FactoryWorkerGameRunRecord extends FactoryWorkerBaseRunRecord {
  kind?: "game";
  runId: string;
  gameName: string;
  requestedLaunchStep: FactoryWorkerGameLaunchScope;
  currentStepId: FactoryWorkerGameLaunchStepId | null;
  activeLease?: {
    launchRequestId: string;
    workflowRunId?: number;
    workflowRunAttempt?: number;
    stepId: FactoryWorkerGameLaunchStepId;
    acquiredAt: string;
    expiresAt: string;
  };
  steps: Array<{
    id: FactoryWorkerGameLaunchStepId;
    title: string;
    status: FactoryWorkerRunStepStatus;
    workflowStepName: string;
    latestEvent: string;
    startedAt?: string;
    finishedAt?: string;
    errorMessage?: string;
  }>;
  artifacts: FactoryWorkerGameArtifacts;
}

export interface FactoryWorkerSeriesAutoRetry {
  enabled: boolean;
  intervalMinutes: number;
  nextRetryAt?: string;
  lastRetryAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface FactoryWorkerSeriesGameRecord {
  gameName: string;
  startTime: number;
  startTimeIso: string;
  durationSeconds?: number;
  seriesGameNumber: number;
  currentStepId: FactoryWorkerSeriesLaunchStepId | null;
  latestEvent: string;
  status: FactoryWorkerRunStepStatus;
  steps?: Array<{
    id: FactoryWorkerSeriesLaunchStepId;
    status: FactoryWorkerRunStepStatus;
    latestEvent: string;
    updatedAt?: string;
    errorMessage?: string;
  }>;
  artifacts: {
    worldAddress?: string;
    indexerCreated?: boolean;
    indexerTier?: FactoryWorkerIndexerTier;
    prizeFunding?: FactoryWorkerPrizeFundingState;
  };
}

export interface FactoryWorkerSeriesRunRecord extends FactoryWorkerBaseRunRecord {
  kind: "series";
  runId: string;
  seriesName: string;
  requestedLaunchStep: FactoryWorkerSeriesLaunchScope;
  currentStepId: FactoryWorkerSeriesLaunchStepId | null;
  activeLease?: {
    launchRequestId: string;
    workflowRunId?: number;
    workflowRunAttempt?: number;
    stepId: FactoryWorkerSeriesLaunchStepId;
    acquiredAt: string;
    expiresAt: string;
  };
  autoRetry: FactoryWorkerSeriesAutoRetry;
  steps: Array<{
    id: FactoryWorkerSeriesLaunchStepId;
    title: string;
    status: FactoryWorkerRunStepStatus;
    workflowStepName: string;
    latestEvent: string;
    startedAt?: string;
    finishedAt?: string;
    errorMessage?: string;
  }>;
  summary: {
    environment: FactoryWorkerEnvironmentId;
    chain: "slot" | "mainnet";
    gameType: "eternum" | "blitz";
    seriesName: string;
    rpcUrl: string;
    factoryAddress: string;
    autoRetryEnabled: boolean;
    autoRetryIntervalMinutes: number;
    dryRun: boolean;
    configMode: "batched" | "sequential";
    seriesCreated: boolean;
    seriesCreatedAt?: string;
    games: FactoryWorkerSeriesGameRecord[];
    outputPath?: string;
  };
  artifacts: {
    summaryPath?: string;
    seriesCreated?: boolean;
    seriesCreatedAt?: string;
  };
}

export interface FactoryWorkerRotationRunRecord extends FactoryWorkerBaseRunRecord {
  kind: "rotation";
  runId: string;
  rotationName: string;
  seriesName: string;
  requestedLaunchStep: FactoryWorkerRotationLaunchScope;
  currentStepId: FactoryWorkerRotationLaunchStepId | null;
  activeLease?: {
    launchRequestId: string;
    workflowRunId?: number;
    workflowRunAttempt?: number;
    stepId: FactoryWorkerRotationLaunchStepId;
    acquiredAt: string;
    expiresAt: string;
  };
  autoRetry: FactoryWorkerSeriesAutoRetry;
  evaluation: FactoryWorkerRotationEvaluation;
  steps: Array<{
    id: FactoryWorkerRotationLaunchStepId;
    title: string;
    status: FactoryWorkerRunStepStatus;
    workflowStepName: string;
    latestEvent: string;
    startedAt?: string;
    finishedAt?: string;
    errorMessage?: string;
  }>;
  summary: {
    environment: FactoryWorkerEnvironmentId;
    chain: "slot" | "mainnet";
    gameType: "eternum" | "blitz";
    rotationName: string;
    seriesName: string;
    firstGameStartTime: number;
    firstGameStartTimeIso: string;
    gameIntervalMinutes: number;
    maxGames: number;
    advanceWindowGames: number;
    evaluationIntervalMinutes: number;
    rpcUrl: string;
    factoryAddress: string;
    autoRetryEnabled: boolean;
    autoRetryIntervalMinutes: number;
    dryRun: boolean;
    configMode: "batched" | "sequential";
    seriesCreated: boolean;
    seriesCreatedAt?: string;
    games: FactoryWorkerSeriesGameRecord[];
    outputPath?: string;
  };
  artifacts: {
    summaryPath?: string;
    seriesCreated?: boolean;
    seriesCreatedAt?: string;
  };
}

export type FactoryWorkerRunRecord =
  | FactoryWorkerGameRunRecord
  | FactoryWorkerSeriesRunRecord
  | FactoryWorkerRotationRunRecord;

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

export interface CreateFactorySeriesRunRequest {
  environment: FactoryWorkerEnvironmentId;
  seriesName: string;
  games: Array<{
    gameName: string;
    startTime: string;
    seriesGameNumber?: number;
  }>;
  devModeOn?: boolean;
  twoPlayerMode?: boolean;
  singleRealmMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  autoRetryIntervalMinutes?: number;
}

export interface CreateFactoryRotationRunRequest {
  environment: FactoryWorkerEnvironmentId;
  rotationName: string;
  firstGameStartTime: string;
  gameIntervalMinutes: number;
  maxGames: number;
  advanceWindowGames?: number;
  evaluationIntervalMinutes: number;
  devModeOn?: boolean;
  twoPlayerMode?: boolean;
  singleRealmMode?: boolean;
  durationSeconds?: number;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  autoRetryIntervalMinutes?: number;
}

interface ContinueFactoryRunRequest {
  environment: FactoryWorkerEnvironmentId;
  gameName: string;
  launchStep?: FactoryWorkerGameLaunchScope;
}

interface ContinueFactorySeriesRunRequest {
  environment: FactoryWorkerEnvironmentId;
  seriesName: string;
  launchStep?: FactoryWorkerSeriesLaunchScope;
  gameNames?: string[];
}

interface ContinueFactoryRotationRunRequest {
  environment: FactoryWorkerEnvironmentId;
  rotationName: string;
  launchStep?: FactoryWorkerRotationLaunchScope;
  gameNames?: string[];
}

interface CancelFactorySeriesAutoRetryRequest {
  environment: FactoryWorkerEnvironmentId;
  seriesName: string;
  adminSecret: string;
  cancelReason?: string;
}

interface CancelFactoryRotationAutoRetryRequest {
  environment: FactoryWorkerEnvironmentId;
  rotationName: string;
  adminSecret: string;
  cancelReason?: string;
}

interface UpdateFactoryIndexerTierRequest {
  environment: FactoryWorkerEnvironmentId;
  gameName?: string;
  gameNames?: string[];
  tier: FactoryWorkerIndexerTier;
  adminSecret: string;
}

interface DeleteFactoryIndexersRequest {
  environment: FactoryWorkerEnvironmentId;
  runKind?: FactoryWorkerRunKind;
  runName?: string;
  gameNames: string[];
  adminSecret: string;
}

interface CreateFactoryIndexersRequest {
  environment: FactoryWorkerEnvironmentId;
  gameNames: string[];
  adminSecret: string;
}

interface ReadFactoryLiveIndexersRequest {
  adminSecret: string;
  gameNames?: string[];
}

interface RefreshFactoryLiveIndexersRequest {
  environment: FactoryWorkerEnvironmentId;
  adminSecret: string;
  gameNames?: string[];
}

interface FundFactoryGamePrizeRequest {
  environment: FactoryWorkerEnvironmentId;
  gameName: string;
  amount: string;
  adminSecret: string;
}

interface FundFactorySeriesPrizesRequest {
  environment: FactoryWorkerEnvironmentId;
  seriesName: string;
  amount: string;
  gameNames?: string[];
  adminSecret: string;
}

interface FundFactoryRotationPrizesRequest {
  environment: FactoryWorkerEnvironmentId;
  rotationName: string;
  amount: string;
  gameNames?: string[];
  adminSecret: string;
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

async function readFactoryRun(
  environment: FactoryWorkerEnvironmentId,
  gameName: string,
): Promise<FactoryWorkerGameRunRecord> {
  return fetchFactoryWorkerJson<FactoryWorkerGameRunRecord>(buildFactoryRunPath(environment, gameName));
}

async function readFactorySeriesRun(
  environment: FactoryWorkerEnvironmentId,
  seriesName: string,
): Promise<FactoryWorkerSeriesRunRecord> {
  return fetchFactoryWorkerJson<FactoryWorkerSeriesRunRecord>(buildFactorySeriesRunPath(environment, seriesName));
}

async function readFactoryRotationRun(
  environment: FactoryWorkerEnvironmentId,
  rotationName: string,
): Promise<FactoryWorkerRotationRunRecord> {
  return fetchFactoryWorkerJson<FactoryWorkerRotationRunRecord>(buildFactoryRotationRunPath(environment, rotationName));
}

export async function readFactoryRunIfPresent(
  environment: FactoryWorkerEnvironmentId,
  gameName: string,
): Promise<FactoryWorkerGameRunRecord | null> {
  try {
    return await readFactoryRun(environment, gameName);
  } catch (error) {
    if (error instanceof FactoryWorkerApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function readFactorySeriesRunIfPresent(
  environment: FactoryWorkerEnvironmentId,
  seriesName: string,
): Promise<FactoryWorkerSeriesRunRecord | null> {
  try {
    return await readFactorySeriesRun(environment, seriesName);
  } catch (error) {
    if (error instanceof FactoryWorkerApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function readFactoryRotationRunIfPresent(
  environment: FactoryWorkerEnvironmentId,
  rotationName: string,
): Promise<FactoryWorkerRotationRunRecord | null> {
  try {
    return await readFactoryRotationRun(environment, rotationName);
  } catch (error) {
    if (error instanceof FactoryWorkerApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function readFactoryRunByNameIfPresent(
  environment: FactoryWorkerEnvironmentId,
  runName: string,
): Promise<FactoryWorkerRunRecord | null> {
  const gameRun = await readFactoryRunIfPresent(environment, runName);
  if (gameRun) {
    return gameRun;
  }

  const seriesRun = await readFactorySeriesRunIfPresent(environment, runName);
  if (seriesRun) {
    return seriesRun;
  }

  return readFactoryRotationRunIfPresent(environment, runName);
}

export async function createFactoryRun(request: CreateFactoryRunRequest): Promise<void> {
  await fetchFactoryWorkerJson("/api/factory/runs", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function createFactorySeriesRun(request: CreateFactorySeriesRunRequest): Promise<void> {
  await fetchFactoryWorkerJson("/api/factory/series-runs", {
    method: "POST",
    body: JSON.stringify({
      ...request,
      autoRetryEnabled: true,
    }),
  });
}

export async function createFactoryRotationRun(request: CreateFactoryRotationRunRequest): Promise<void> {
  await fetchFactoryWorkerJson("/api/factory/rotation-runs", {
    method: "POST",
    body: JSON.stringify({
      ...request,
      autoRetryEnabled: true,
    }),
  });
}

export async function continueFactoryRun(request: ContinueFactoryRunRequest): Promise<void> {
  await fetchFactoryWorkerJson(`${buildFactoryRunPath(request.environment, request.gameName)}/actions/continue`, {
    method: "POST",
    body: JSON.stringify(request.launchStep ? { launchStep: request.launchStep } : {}),
  });
}

export async function continueFactorySeriesRun(request: ContinueFactorySeriesRunRequest): Promise<void> {
  await fetchFactoryWorkerJson(
    `${buildFactorySeriesRunPath(request.environment, request.seriesName)}/actions/continue`,
    {
      method: "POST",
      body: JSON.stringify({
        ...(request.launchStep ? { launchStep: request.launchStep } : {}),
        ...(request.gameNames ? { gameNames: request.gameNames } : {}),
      }),
    },
  );
}

export async function continueFactoryRotationRun(request: ContinueFactoryRotationRunRequest): Promise<void> {
  await fetchFactoryWorkerJson(
    `${buildFactoryRotationRunPath(request.environment, request.rotationName)}/actions/continue`,
    {
      method: "POST",
      body: JSON.stringify({
        ...(request.launchStep ? { launchStep: request.launchStep } : {}),
        ...(request.gameNames ? { gameNames: request.gameNames } : {}),
      }),
    },
  );
}

export async function nudgeFactoryRotationRun(
  environment: FactoryWorkerEnvironmentId,
  rotationName: string,
): Promise<void> {
  await fetchFactoryWorkerJson(`${buildFactoryRotationRunPath(environment, rotationName)}/actions/nudge`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function cancelFactorySeriesAutoRetry(request: CancelFactorySeriesAutoRetryRequest): Promise<void> {
  const { adminSecret, environment, seriesName, cancelReason } = request;
  await fetchFactoryWorkerJson(`${buildFactorySeriesRunPath(environment, seriesName)}/actions/cancel-auto-retry`, {
    method: "POST",
    headers: { [FACTORY_WORKER_ADMIN_SECRET_HEADER]: adminSecret },
    body: JSON.stringify({ cancelReason }),
  });
}

export async function cancelFactoryRotationAutoRetry(request: CancelFactoryRotationAutoRetryRequest): Promise<void> {
  const { adminSecret, environment, rotationName, cancelReason } = request;
  await fetchFactoryWorkerJson(`${buildFactoryRotationRunPath(environment, rotationName)}/actions/cancel-auto-retry`, {
    method: "POST",
    headers: { [FACTORY_WORKER_ADMIN_SECRET_HEADER]: adminSecret },
    body: JSON.stringify({ cancelReason }),
  });
}

export async function updateFactoryIndexerTier(request: UpdateFactoryIndexerTierRequest): Promise<void> {
  const { adminSecret, ...body } = request;
  await fetchFactoryWorkerJson("/api/factory/indexers/tier", {
    method: "POST",
    headers: { [FACTORY_WORKER_ADMIN_SECRET_HEADER]: adminSecret },
    body: JSON.stringify(body),
  });
}

export async function createFactoryIndexers(request: CreateFactoryIndexersRequest): Promise<void> {
  const { adminSecret, ...body } = request;
  await fetchFactoryWorkerJson("/api/factory/indexers/create", {
    method: "POST",
    headers: { [FACTORY_WORKER_ADMIN_SECRET_HEADER]: adminSecret },
    body: JSON.stringify(body),
  });
}

export async function deleteFactoryIndexers(request: DeleteFactoryIndexersRequest): Promise<void> {
  const { adminSecret, ...body } = request;
  await fetchFactoryWorkerJson("/api/factory/indexers/delete", {
    method: "POST",
    headers: { [FACTORY_WORKER_ADMIN_SECRET_HEADER]: adminSecret },
    body: JSON.stringify(body),
  });
}

export async function readFactoryLiveIndexers(
  request: ReadFactoryLiveIndexersRequest,
): Promise<FactoryWorkerLiveIndexerResponse> {
  const { adminSecret, ...body } = request;
  return fetchFactoryWorkerJson("/api/factory/indexers/live", {
    method: "POST",
    headers: { [FACTORY_WORKER_ADMIN_SECRET_HEADER]: adminSecret },
    body: JSON.stringify(body),
  });
}

export async function refreshFactoryLiveIndexers(request: RefreshFactoryLiveIndexersRequest): Promise<void> {
  const { adminSecret, ...body } = request;
  await fetchFactoryWorkerJson("/api/factory/indexers/live/refresh", {
    method: "POST",
    headers: { [FACTORY_WORKER_ADMIN_SECRET_HEADER]: adminSecret },
    body: JSON.stringify(body),
  });
}

export async function fundFactoryGamePrize(request: FundFactoryGamePrizeRequest): Promise<void> {
  const { adminSecret, environment, gameName, amount } = request;
  await fetchFactoryWorkerJson(`${buildFactoryRunPath(environment, gameName)}/actions/fund-prize`, {
    method: "POST",
    headers: { [FACTORY_WORKER_ADMIN_SECRET_HEADER]: adminSecret },
    body: JSON.stringify({ amount }),
  });
}

export async function fundFactorySeriesPrizes(request: FundFactorySeriesPrizesRequest): Promise<void> {
  const { adminSecret, environment, seriesName, amount, gameNames } = request;
  await fetchFactoryWorkerJson(`${buildFactorySeriesRunPath(environment, seriesName)}/actions/fund-prize`, {
    method: "POST",
    headers: { [FACTORY_WORKER_ADMIN_SECRET_HEADER]: adminSecret },
    body: JSON.stringify({ amount, gameNames }),
  });
}

export async function fundFactoryRotationPrizes(request: FundFactoryRotationPrizesRequest): Promise<void> {
  const { adminSecret, environment, rotationName, amount, gameNames } = request;
  await fetchFactoryWorkerJson(`${buildFactoryRotationRunPath(environment, rotationName)}/actions/fund-prize`, {
    method: "POST",
    headers: { [FACTORY_WORKER_ADMIN_SECRET_HEADER]: adminSecret },
    body: JSON.stringify({ amount, gameNames }),
  });
}

function buildFactoryRunPath(environment: FactoryWorkerEnvironmentId, gameName: string) {
  return `/api/factory/runs/${encodeURIComponent(environment)}/${encodeURIComponent(gameName)}`;
}

function buildFactorySeriesRunPath(environment: FactoryWorkerEnvironmentId, seriesName: string) {
  return `/api/factory/series-runs/${encodeURIComponent(environment)}/${encodeURIComponent(seriesName)}`;
}

function buildFactoryRotationRunPath(environment: FactoryWorkerEnvironmentId, rotationName: string) {
  return `/api/factory/rotation-runs/${encodeURIComponent(environment)}/${encodeURIComponent(rotationName)}`;
}

function isMissingListEndpoint(error: unknown) {
  return error instanceof FactoryWorkerApiError && (error.status === 404 || error.status === 405);
}

async function fetchFactoryWorkerJson<ResponseBody>(
  pathname: string,
  options: {
    method?: "GET" | "POST";
    query?: Record<string, string | undefined>;
    headers?: Record<string, string | undefined>;
    body?: string;
  } = {},
): Promise<ResponseBody> {
  const requestHeaders = new Headers();
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (typeof value === "string") {
      requestHeaders.set(name, value);
    }
  }

  if (options.body) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(buildFactoryWorkerUrl(pathname, options.query), {
    method: options.method ?? "GET",
    headers: requestHeaders,
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
