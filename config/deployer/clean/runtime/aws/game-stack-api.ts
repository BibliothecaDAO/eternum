import { readFileSync } from "node:fs";
import {
  assertProductionReleaseAuthorized,
  createGameStackApiHandler,
  verifyCartridgeWalletSignature,
  type FinalizedSeasonIntent,
  type GameStack,
} from "../../game-stack";
import { runAwsCommand, type AwsCommandRunner } from "./commands";
import { createAwsCliGameStackApiStore } from "./game-stack-control";

export interface AwsGameStackApiConfig {
  tableName: string;
  region: string;
  mainnetRpcUrl: string;
  seasonIntentReaderUrl: string;
  orchestratorUrl: string;
  serviceToken: string;
}

export interface AwsGameStackApiAdapters {
  commandRunner?: AwsCommandRunner;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  randomUuid?: () => string;
}

export function createAwsGameStackApiHandler(
  config: AwsGameStackApiConfig,
  adapters: AwsGameStackApiAdapters = {},
): (request: Request) => Promise<Response> {
  validateAwsGameStackApiConfig(config);
  const commandRunner = adapters.commandRunner ?? runAwsCommand;
  const fetchImpl = adapters.fetchImpl ?? fetch;
  const now = adapters.now ?? (() => new Date());
  const randomUuid = adapters.randomUuid ?? (() => crypto.randomUUID());
  const store = createAwsCliGameStackApiStore(commandRunner, {
    tableName: config.tableName,
    region: config.region,
    environmentId: "mainnet.blitz",
    now,
  });

  return createGameStackApiHandler({
    store,
    now,
    generateFeltId: () => uuidToFelt(randomUuid()),
    generateGameStackId: randomUuid,
    verifySignature: (challenge, signature) =>
      verifyCartridgeWalletSignature({
        rpcUrl: config.mainnetRpcUrl,
        requesterWallet: challenge.requesterWallet,
        messageHash: challenge.messageHash,
        signature,
        fetchImpl,
      }),
    readFinalizedSeasonIntent: (deploymentId) => readFinalizedSeasonIntent(config, deploymentId, fetchImpl),
    assertProductionReleaseAuthorized: async () => assertCurrentWave0ReleaseDecision(),
    dispatchProvisioning: (gameStack, idempotencyKey) =>
      dispatchGameStackProvisioning(config, gameStack, idempotencyKey, fetchImpl),
  });
}

function assertCurrentWave0ReleaseDecision(): void {
  const decisionUrl = new URL(
    "../../../../../packages/settlement-codec/schema/wave0-a23-stop-decision-v1.json",
    import.meta.url,
  );
  assertProductionReleaseAuthorized(JSON.parse(readFileSync(decisionUrl, "utf8")) as unknown);
}

async function readFinalizedSeasonIntent(
  config: AwsGameStackApiConfig,
  deploymentId: string,
  fetchImpl: typeof fetch,
): Promise<FinalizedSeasonIntent> {
  const url = new URL(`/v1/season-intents/${encodeURIComponent(deploymentId)}`, config.seasonIntentReaderUrl);
  const response = await fetchImpl(url, {
    headers: buildServiceHeaders(config.serviceToken),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Finalized SeasonIntent verification failed with HTTP ${response.status}`);
  }
  return (await response.json()) as FinalizedSeasonIntent;
}

async function dispatchGameStackProvisioning(
  config: AwsGameStackApiConfig,
  gameStack: GameStack,
  idempotencyKey: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  const url = new URL(
    `/v1/blitz/game-stacks/${encodeURIComponent(gameStack.gameStackId)}/provisioning`,
    config.orchestratorUrl,
  );
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { ...buildServiceHeaders(config.serviceToken), "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(gameStack),
  });
  if (!response.ok) {
    throw new Error(`Game-stack provisioning dispatch failed with HTTP ${response.status}`);
  }
}

function buildServiceHeaders(serviceToken: string): Record<string, string> {
  return { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" };
}

function uuidToFelt(uuid: string): string {
  return `0x${uuid.replaceAll("-", "")}`;
}

function validateAwsGameStackApiConfig(config: AwsGameStackApiConfig): void {
  for (const [name, value] of Object.entries(config)) {
    if (!value.trim()) throw new Error(`AWS game-stack API requires ${name}`);
  }
  for (const [name, value] of [
    ["mainnetRpcUrl", config.mainnetRpcUrl],
    ["seasonIntentReaderUrl", config.seasonIntentReaderUrl],
    ["orchestratorUrl", config.orchestratorUrl],
  ]) {
    if (new URL(value).protocol !== "https:") throw new Error(`AWS game-stack API requires HTTPS ${name}`);
  }
}
