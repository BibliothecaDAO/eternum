import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { IndexerCreationResult, IndexerRequest } from "../types";

const exec = promisify(execFile);

/**
 * Appchain indexer provider.
 *
 * The appchain runs ONE torii that indexes every world (see
 * docs/plans/appchain-phase-1.md), so "creating an indexer" for a new game is
 * not a deployment at all — it is appending one `WORLD:<address>` entry to the
 * shared torii config and rolling the service. That replaces Slot's
 * `slot deployments create ... torii` per game.
 *
 * The config lives in SSM (injected into the task as an env var at start), so
 * the whole operation is: get-parameter -> append -> put-parameter ->
 * update-service --force-new-deployment.
 */

const DEFAULT_PARAMETER_NAME = process.env.APPCHAIN_TORII_CONFIG_PARAM ?? "/realms-appchain/dev/torii-config";
const DEFAULT_CLUSTER = process.env.APPCHAIN_ECS_CLUSTER ?? "realms-appchain-dev";
const DEFAULT_SERVICE = process.env.APPCHAIN_TORII_SERVICE ?? "torii";
const DEFAULT_REGION = process.env.AWS_REGION ?? "us-east-1";

export interface AppchainIndexerOptions {
  onProgress?: (message: string) => void;
  parameterName?: string;
  cluster?: string;
  service?: string;
  region?: string;
}

const aws = async (args: string[]): Promise<string> => {
  const { stdout } = await exec("aws", args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
};

const normalizeAddress = (address: string): string => `0x${BigInt(address).toString(16)}`;

/** True when the config already lists this world (compared numerically). */
export const configContainsWorld = (config: string, worldAddress: string): boolean => {
  const target = BigInt(worldAddress);
  const listed = config.matchAll(/"WORLD:(0x[0-9a-fA-F]+)/g);
  for (const [, address] of listed) {
    try {
      if (BigInt(address) === target) return true;
    } catch {
      // ignore malformed entries
    }
  }
  return false;
};

/** Inserts a `WORLD:<address>` entry into the `contracts = [...]` array. */
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
  const parameterName = options.parameterName ?? DEFAULT_PARAMETER_NAME;
  const cluster = options.cluster ?? DEFAULT_CLUSTER;
  const service = options.service ?? DEFAULT_SERVICE;
  const region = options.region ?? DEFAULT_REGION;
  const progress = options.onProgress ?? (() => {});

  progress(`reading torii config from ${parameterName}`);
  const current = await aws([
    "ssm",
    "get-parameter",
    "--name",
    parameterName,
    "--region",
    region,
    "--query",
    "Parameter.Value",
    "--output",
    "text",
  ]);

  if (configContainsWorld(current, request.worldAddress)) {
    progress(`world ${request.worldAddress} already indexed — leaving torii untouched`);
    return { mode: "github-actions", action: "already-live" };
  }

  const updated = appendWorldToConfig(current, request.worldAddress);
  progress(`appending world ${request.worldAddress} to the shared torii config`);
  await aws([
    "ssm",
    "put-parameter",
    "--name",
    parameterName,
    "--type",
    "String",
    "--overwrite",
    "--value",
    updated,
    "--region",
    region,
  ]);

  progress(`redeploying ${cluster}/${service} so torii picks up the new world`);
  await aws([
    "ecs",
    "update-service",
    "--cluster",
    cluster,
    "--service",
    service,
    "--force-new-deployment",
    "--region",
    region,
    "--query",
    "service.serviceName",
    "--output",
    "text",
  ]);

  return { mode: "github-actions", action: "created" };
}
