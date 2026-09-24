#!/usr/bin/env bun
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Account, addAddressPadding, RpcProvider } from "starknet";
import { deviceKeyOf, joinBotAccount, type RealmsAccountShard } from "@bibliothecadao/eternum";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import type { ShardRecord } from "../../../apps/herald/src/shard-manifest";

import { declareClass, readClassArtifact } from "../../../config/deployer/clean/shared/declare";

import { createMadaraAccount } from "../../../config/deployer/clean/shared/madara-account";

const LAB_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(LAB_DIRECTORY, "../..");
const CONTRACT_DIRECTORY = resolve(REPOSITORY_ROOT, "contracts/l3/player-account");
const ARTIFACT_DIRECTORY = resolve(CONTRACT_DIRECTORY, "target/dev");
const OUTPUT_PATH = resolve(requiredEnvironment("GAMEPLAY_CONTRACTS_PATH"));

const RPC_URL = requiredEnvironment("RPC_URL");
const DEPLOYER_ADDRESS = requiredEnvironment("DEPLOYER_ACCOUNT_ADDRESS");
const DEPLOYER_PRIVATE_KEY = requiredEnvironment("DEPLOYER_PRIVATE_KEY");

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const PLAYER_ACCOUNT_ARTIFACT = "realms_player_account_RealmsAccount.contract_class.json";

interface GameplayDeploymentResult {
  operatorAccountAddress: string;
  /** The bot label that names the operator's Realms account; its device changes are approved under it. */
  operatorLabel: string;
  playerAccountClassHash: string;
  rpcUrl: string;
}

/** The one account class every player, bot and operator runs: the class the identity service approves devices for. */
async function declareAccountClass(account: Account, accountClassHash: string): Promise<string> {
  const artifact = readClassArtifact(
    resolve(ARTIFACT_DIRECTORY, PLAYER_ACCOUNT_ARTIFACT),
    resolve(ARTIFACT_DIRECTORY, PLAYER_ACCOUNT_ARTIFACT.replace(".contract_class.json", ".compiled_contract_class.json")),
  );
  if (BigInt(artifact.classHash) !== BigInt(accountClassHash)) {
    throw new Error(`RealmsAccount class ${artifact.classHash} differs from guardian class ${accountClassHash}`);
  }
  await declareClass(account, artifact, (transactionHash) => {
    console.error(JSON.stringify({ event: "gameplay_class_declared", classHash: artifact.classHash, transactionHash }));
  });
  return artifact.classHash;
}

function writeDeploymentResult(result: GameplayDeploymentResult): void {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  const temporaryPath = `${OUTPUT_PATH}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(result, null, 2)}\n`);
  renameSync(temporaryPath, OUTPUT_PATH);
}

async function deployGameplayContracts(): Promise<GameplayDeploymentResult> {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const manifest = readShardManifest<{ shard: ShardRecord }>(process.env.NATIVE_WORLD_MANIFEST);
  await assertProviderChain(provider, manifest, "RPC_URL");
  const account = createMadaraAccount(provider, DEPLOYER_ADDRESS, DEPLOYER_PRIVATE_KEY);
  const playerAccountClassHash = await declareAccountClass(account, manifest.shard.accountClassHash);
  const operatorAccountAddress = await prepareOperator(provider, {
    chainId: await provider.getChainId(),
    accountClassHash: playerAccountClassHash,
    guardianPublicKey: manifest.shard.guardianPublicKey,
  });
  const result = {
    operatorAccountAddress,
    operatorLabel: DEPLOYER_ADDRESS,
    playerAccountClassHash,
    rpcUrl: RPC_URL,
  } satisfies GameplayDeploymentResult;
  writeDeploymentResult(result);
  return result;
}

/**
 * The operator is a bot named by its deployer address: a Realms account under the shard's guardian, its one device the
 * deployer key, approved through the identity Worker's operator route like every bot.
 */
async function prepareOperator(provider: RpcProvider, shard: RealmsAccountShard): Promise<string> {
  const operator = await joinBotAccount({
    provider,
    shard,
    label: DEPLOYER_ADDRESS,
    device: deviceKeyOf(DEPLOYER_PRIVATE_KEY),
    identity: { url: requiredEnvironment("IDENTITY_URL"), operatorToken: requiredEnvironment("OPERATOR_TOKEN") },
  });
  return addAddressPadding(operator.address);
}

deployGameplayContracts()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
