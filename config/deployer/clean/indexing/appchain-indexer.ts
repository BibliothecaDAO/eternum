import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { IndexerCreationResult, IndexerRequest } from "../types";

const exec = promisify(execFile);

const DEFAULT_PARAMETER_NAME = process.env.APPCHAIN_TORII_CONFIG_PARAM ?? "/realms-appchain/dev/torii-config";
const DEFAULT_ADMIN_SECRET_ID = process.env.APPCHAIN_TORII_ADMIN_SECRET_ID ?? "/realms-appchain/dev/torii-admin-token";
const DEFAULT_TORII_URL = process.env.APPCHAIN_TORII_URL ?? "https://torii.jcndata.com";
const DEFAULT_REGION = process.env.AWS_REGION ?? "us-east-1";
const DEFAULT_INDEXING_TIMEOUT_MS = 15 * 60 * 1_000;
const DEFAULT_INDEXING_POLL_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const MAX_REGISTRATION_ATTEMPTS = 5;

type AwsCommand = (args: string[]) => Promise<string>;
type Sleep = (durationMs: number) => Promise<void>;

export interface AppchainIndexerOptions {
  onProgress?: (message: string) => void;
  parameterName?: string;
  adminSecretId?: string;
  toriiUrl?: string;
  region?: string;
  indexingTimeoutMs?: number;
  indexingPollMs?: number;
  requestTimeoutMs?: number;
  awsCommand?: AwsCommand;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  now?: () => number;
}

interface AppchainIndexerRuntime {
  adminSecretId: string;
  awsCommand: AwsCommand;
  fetchImpl: typeof fetch;
  indexingPollMs: number;
  indexingTimeoutMs: number;
  now: () => number;
  onProgress: (message: string) => void;
  parameterName: string;
  region: string;
  requestTimeoutMs: number;
  sleep: Sleep;
  toriiUrl: string;
}

interface ToriiRegistrationResponse {
  outcome: "registered" | "already_registered";
  target_head: number;
}

interface ToriiContractStatusResponse {
  contract: {
    address: string;
    contract_type: string;
    head: number | null;
    chain_head: number;
    ready: boolean;
  };
}

const defaultAwsCommand: AwsCommand = async (args) => {
  const { stdout } = await exec("aws", args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
};

const defaultSleep: Sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

const normalizeAddress = (address: string): string => `0x${BigInt(address).toString(16)}`;

export const configContainsWorld = (config: string, worldAddress: string): boolean => {
  const target = BigInt(worldAddress);
  const listed = config.matchAll(/"WORLD:(0x[0-9a-fA-F]+)/g);
  for (const [, address] of listed) {
    try {
      if (BigInt(address) === target) return true;
    } catch {
      // A malformed entry is not the requested world.
    }
  }
  return false;
};

export const appendWorldToConfig = (config: string, worldAddress: string): string => {
  if (configContainsWorld(config, worldAddress)) return config;

  const entry = `\t"WORLD:${normalizeAddress(worldAddress)}",`;
  const match = config.match(/contracts\s*=\s*\[/);
  if (!match || match.index === undefined) {
    throw new Error("torii config has no `contracts = [` array to append to");
  }

  const insertAt = match.index + match[0].length;
  return `${config.slice(0, insertAt)}\n${entry}${config.slice(insertAt)}`;
};

export async function createAppchainIndexer(
  request: IndexerRequest,
  options: AppchainIndexerOptions = {},
): Promise<IndexerCreationResult> {
  const runtime = resolveRuntime(options);
  const configChanged = await persistDesiredWorld(runtime, request.worldAddress);
  const adminToken = await readAdminToken(runtime);
  const registration = await registerWorld(runtime, request.worldAddress, adminToken);

  await waitForWorldToBeIndexed(runtime, request.worldAddress, adminToken);

  return {
    mode: "github-actions",
    action: configChanged || registration.outcome === "registered" ? "created" : "already-live",
  };
}

function resolveRuntime(options: AppchainIndexerOptions): AppchainIndexerRuntime {
  return {
    adminSecretId: options.adminSecretId ?? DEFAULT_ADMIN_SECRET_ID,
    awsCommand: options.awsCommand ?? defaultAwsCommand,
    fetchImpl: options.fetchImpl ?? fetch,
    indexingPollMs: options.indexingPollMs ?? DEFAULT_INDEXING_POLL_MS,
    indexingTimeoutMs: options.indexingTimeoutMs ?? DEFAULT_INDEXING_TIMEOUT_MS,
    now: options.now ?? Date.now,
    onProgress: options.onProgress ?? (() => {}),
    parameterName: options.parameterName ?? DEFAULT_PARAMETER_NAME,
    region: options.region ?? DEFAULT_REGION,
    requestTimeoutMs: options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    sleep: options.sleep ?? defaultSleep,
    toriiUrl: options.toriiUrl ?? DEFAULT_TORII_URL,
  };
}

async function persistDesiredWorld(runtime: AppchainIndexerRuntime, worldAddress: string): Promise<boolean> {
  runtime.onProgress(`reading torii config from ${runtime.parameterName}`);
  const current = await runtime.awsCommand([
    "ssm",
    "get-parameter",
    "--name",
    runtime.parameterName,
    "--region",
    runtime.region,
    "--query",
    "Parameter.Value",
    "--output",
    "text",
  ]);

  if (configContainsWorld(current, worldAddress)) {
    runtime.onProgress(`world ${worldAddress} already exists in durable torii config`);
    return false;
  }

  runtime.onProgress(`persisting world ${worldAddress} in the shared torii config`);
  await runtime.awsCommand([
    "ssm",
    "put-parameter",
    "--name",
    runtime.parameterName,
    "--type",
    "String",
    "--overwrite",
    "--value",
    appendWorldToConfig(current, worldAddress),
    "--region",
    runtime.region,
  ]);
  return true;
}

async function readAdminToken(runtime: AppchainIndexerRuntime): Promise<string> {
  runtime.onProgress(`reading torii management token from ${runtime.adminSecretId}`);
  const token = await runtime.awsCommand([
    "secretsmanager",
    "get-secret-value",
    "--secret-id",
    runtime.adminSecretId,
    "--region",
    runtime.region,
    "--query",
    "SecretString",
    "--output",
    "text",
  ]);
  if (!token) {
    throw new Error(`Torii management secret ${runtime.adminSecretId} is empty`);
  }
  return token;
}

async function registerWorld(
  runtime: AppchainIndexerRuntime,
  worldAddress: string,
  adminToken: string,
): Promise<ToriiRegistrationResponse> {
  runtime.onProgress(`hot-adding world ${worldAddress} to torii`);
  const url = `${normalizeToriiUrl(runtime.toriiUrl)}/admin/indexing/contracts`;
  const body = JSON.stringify({
    address: normalizeAddress(worldAddress),
    contract_type: "WORLD",
  });

  for (let attempt = 1; attempt <= MAX_REGISTRATION_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await runtime.fetchImpl(url, {
        method: "POST",
        headers: adminHeaders(adminToken),
        body,
        signal: AbortSignal.timeout(runtime.requestTimeoutMs),
      });
    } catch (error) {
      if (attempt === MAX_REGISTRATION_ATTEMPTS) throw error;
      await runtime.sleep(registrationRetryDelay(attempt));
      continue;
    }

    if (response.ok) {
      return parseRegistrationResponse(await response.json());
    }
    if (!isRetryableStatus(response.status) || attempt === MAX_REGISTRATION_ATTEMPTS) {
      throw await buildToriiRequestError("register world", response);
    }

    await runtime.sleep(registrationRetryDelay(attempt));
  }

  throw new Error("Torii world registration exhausted all attempts");
}

async function waitForWorldToBeIndexed(
  runtime: AppchainIndexerRuntime,
  worldAddress: string,
  adminToken: string,
): Promise<void> {
  runtime.onProgress(`waiting for torii to index world ${worldAddress}`);
  const deadline = runtime.now() + runtime.indexingTimeoutMs;
  const url = `${normalizeToriiUrl(runtime.toriiUrl)}/admin/indexing/contracts/${normalizeAddress(worldAddress)}`;
  let lastStatus: ToriiContractStatusResponse["contract"] | undefined;

  while (runtime.now() < deadline) {
    let response: Response;
    try {
      response = await runtime.fetchImpl(url, {
        method: "GET",
        headers: adminHeaders(adminToken),
        signal: AbortSignal.timeout(runtime.requestTimeoutMs),
      });
    } catch {
      await runtime.sleep(runtime.indexingPollMs);
      continue;
    }
    if (response.ok) {
      const status = parseContractStatusResponse(await response.json()).contract;
      lastStatus = status;
      if (status.ready) {
        runtime.onProgress(`torii indexed world ${worldAddress} through block ${status.head}`);
        return;
      }
    } else if (!isRetryableStatus(response.status) && response.status !== 404) {
      throw await buildToriiRequestError("read world indexing status", response);
    }

    await runtime.sleep(runtime.indexingPollMs);
  }

  const cursor = lastStatus?.head ?? "unavailable";
  const chainHead = lastStatus?.chain_head ?? "unavailable";
  throw new Error(
    `Torii did not finish indexing world ${worldAddress} within ${runtime.indexingTimeoutMs}ms ` +
      `(cursor ${cursor}, chain head ${chainHead})`,
  );
}

function adminHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function normalizeToriiUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function registrationRetryDelay(attempt: number): number {
  return Math.min(2 ** (attempt - 1) * 1_000, 8_000);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function parseRegistrationResponse(value: unknown): ToriiRegistrationResponse {
  if (!isRecord(value) || (value.outcome !== "registered" && value.outcome !== "already_registered")) {
    throw new Error("Torii returned an invalid contract registration response");
  }
  if (typeof value.target_head !== "number") {
    throw new Error("Torii registration response has no numeric target_head");
  }
  return value as unknown as ToriiRegistrationResponse;
}

function parseContractStatusResponse(value: unknown): ToriiContractStatusResponse {
  if (!isRecord(value) || !isValidContractStatus(value.contract)) {
    throw new Error("Torii returned an invalid contract indexing status response");
  }
  return value as unknown as ToriiContractStatusResponse;
}

function isValidContractStatus(value: unknown): value is ToriiContractStatusResponse["contract"] {
  return (
    isRecord(value) &&
    typeof value.address === "string" &&
    typeof value.contract_type === "string" &&
    (value.head === null || typeof value.head === "number") &&
    typeof value.chain_head === "number" &&
    typeof value.ready === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function buildToriiRequestError(action: string, response: Response): Promise<Error> {
  const responseBody = await response.text();
  return new Error(
    `Failed to ${action}: Torii returned HTTP ${response.status}${responseBody ? `: ${responseBody}` : ""}`,
  );
}
