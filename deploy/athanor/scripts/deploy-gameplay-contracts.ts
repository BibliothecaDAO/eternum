#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Account, addAddressPadding, RpcProvider } from "starknet";
import {
  deviceKeyOf,
  joinBotAccount,
  joinRealmsAccount,
  type DeviceKey,
  type RealmsAccountShard,
} from "@bibliothecadao/eternum";
import type { OperatorEnrolment } from "../../../packages/identity/src/operator-enrolment";
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
  /** The bot label that names our shards' operator; null when a community operator enrolled their own Realms account. */
  operatorLabel: string | null;
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
  const operator = await prepareOperator(provider, {
    chainId: await provider.getChainId(),
    accountClassHash: playerAccountClassHash,
    guardianPublicKey: manifest.shard.guardianPublicKey,
  });
  const result = {
    operatorAccountAddress: addAddressPadding(operator.address),
    operatorLabel: operator.label,
    playerAccountClassHash,
    rpcUrl: RPC_URL,
  } satisfies GameplayDeploymentResult;
  writeDeploymentResult(result);
  return result;
}

/**
 * The operator's Realms account, under the shard's guardian, with the deployer key as its one device. A community
 * operator enrolled their own Realms account before initialization (enrol-operator.ts); our own shards' operator is the
 * bot named by the deployer address, approved through the identity Worker's operator route.
 */
async function prepareOperator(
  provider: RpcProvider,
  shard: RealmsAccountShard,
): Promise<{ address: string; label: string | null }> {
  const device = deviceKeyOf(DEPLOYER_PRIVATE_KEY);
  const enrolment = readOperatorEnrolment();
  if (enrolment) {
    const operator = await joinRealmsAccount({
      provider,
      shard,
      realmsId: enrolment.realmsId,
      device,
      approve: enrolledApproval(enrolment, device),
    });
    return { address: operator.address, label: null };
  }
  const operator = await joinBotAccount({ provider, shard, label: DEPLOYER_ADDRESS, device, identity: operatorIdentity() });
  return { address: operator.address, label: DEPLOYER_ADDRESS };
}

function readOperatorEnrolment(): OperatorEnrolment | null {
  const path = requiredEnvironment("OPERATOR_ENROLMENT_PATH");
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as OperatorEnrolment) : null;
}

/** The enrolment approves exactly one change: this deployer key as the account's first device. */
const enrolledApproval =
  (enrolment: OperatorEnrolment, device: DeviceKey) =>
  async (change: { action: string; deviceKey: string; counter: number }): Promise<string[]> => {
    if (change.action !== "ADD" || change.counter !== 1 || BigInt(change.deviceKey) !== BigInt(device.publicKey)) {
      throw new Error("The operator enrolment approves only the deployer key as the first device of a new account");
    }
    if (BigInt(enrolment.deviceKey) !== BigInt(device.publicKey)) {
      throw new Error("The operator enrolment was made for another deployer key; enrol this shard's operator again");
    }
    return enrolment.signature;
  };

function operatorIdentity() {
  const operatorToken = process.env.OPERATOR_TOKEN?.trim();
  if (!operatorToken) {
    throw new Error(
      "The operator enrols through the shard's guardian: run deploy/athanor/scripts/enrol-operator.ts before " +
        "initialization, or set OPERATOR_TOKEN in our own environments",
    );
  }
  return { url: requiredEnvironment("IDENTITY_URL"), operatorToken };
}

deployGameplayContracts()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
