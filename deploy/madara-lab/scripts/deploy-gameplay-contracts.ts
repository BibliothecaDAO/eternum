#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Account, addAddressPadding, hash, RpcProvider } from "starknet";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";

import {
  declareClass,
  readClassArtifact,
  rpcErrorCode,
  waitForSuccess,
} from "../../../config/deployer/clean/shared/declare";

import { createMadaraAccount } from "../../../config/deployer/clean/shared/madara-account";

const LAB_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(LAB_DIRECTORY, "../..");
const CONTRACT_DIRECTORY = resolve(REPOSITORY_ROOT, "contracts/l3/player-account");
const ARTIFACT_DIRECTORY = resolve(CONTRACT_DIRECTORY, "target/dev");
const OUTPUT_PATH = resolve(LAB_DIRECTORY, ".lab/gameplay-contracts.json");

const RPC_URL = requiredEnvironment("RPC_URL");
const DEPLOYER_ADDRESS = requiredEnvironment("NATIVE_ACCOUNT_ADDRESS");
const DEPLOYER_PRIVATE_KEY = requiredEnvironment("NATIVE_PRIVATE_KEY");
const BINDING_AUTHORITY_ADDRESS = requiredEnvironment("BINDING_AUTHORITY_ADDRESS");

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const PLAYER_ACCOUNT_ARTIFACT = "realms_player_account_RealmsPlayerAccount.contract_class.json";
const PLAYER_REGISTRY_ARTIFACT = "realms_player_account_PlayerRegistry.contract_class.json";

interface GameplayDeploymentResult {
  bindingAuthorityAddress: string;
  playerAccountClassHash: string;
  playerRegistryAddress: string;
  playerRegistryClassHash: string;
  rpcUrl: string;
}

function runCommand(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
  }
}

function buildGameplayContracts(): void {
  runCommand("scarb", ["build"], CONTRACT_DIRECTORY);
}

async function declareGameplayContracts(account: Account) {
  const artifacts = [PLAYER_ACCOUNT_ARTIFACT, PLAYER_REGISTRY_ARTIFACT].map((name) =>
    readClassArtifact(
      resolve(ARTIFACT_DIRECTORY, name),
      resolve(ARTIFACT_DIRECTORY, name.replace(".contract_class.json", ".compiled_contract_class.json")),
    ),
  );
  for (const artifact of artifacts) {
    await declareClass(account, artifact, (transactionHash) => {
      console.error(
        JSON.stringify({ event: "gameplay_class_declared", classHash: artifact.classHash, transactionHash }),
      );
    });
  }
  return { playerAccountClassHash: artifacts[0].classHash, playerRegistryClassHash: artifacts[1].classHash };
}

function resolvePlayerRegistryAddress(classHash: string): string {
  return addAddressPadding(hash.calculateContractAddressFromHash("0x0", classHash, [BINDING_AUTHORITY_ADDRESS], "0x0"));
}

async function isExpectedContractDeployed(provider: RpcProvider, address: string, classHash: string): Promise<boolean> {
  try {
    const deployedClassHash = await provider.getClassHashAt(address);
    if (BigInt(deployedClassHash) !== BigInt(classHash)) {
      throw new Error(`Contract ${address} has class ${deployedClassHash}, expected ${classHash}`);
    }
    return true;
  } catch (error) {
    if (rpcErrorCode(error) === 20) return false;
    throw error;
  }
}

async function deployPlayerRegistryIfNeeded(provider: Account, classHash: string, address: string): Promise<void> {
  if (await isExpectedContractDeployed(provider, address, classHash)) {
    return;
  }

  const result = await provider.deployContract(
    {
      classHash,
      salt: "0x0",
      constructorCalldata: [BINDING_AUTHORITY_ADDRESS],
      unique: false,
    },
    { tip: 0 },
  );
  await waitForSuccess(provider, result.transaction_hash);

  if (!(await isExpectedContractDeployed(provider, address, classHash))) {
    throw new Error(`PlayerRegistry deployment did not produce the expected contract at ${address}`);
  }
}

function writeDeploymentResult(result: GameplayDeploymentResult): void {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  const temporaryPath = `${OUTPUT_PATH}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(result, null, 2)}\n`);
  renameSync(temporaryPath, OUTPUT_PATH);
}

async function deployGameplayContracts(): Promise<GameplayDeploymentResult> {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  await assertProviderChain(provider, "madara", "RPC_URL");
  buildGameplayContracts();
  const account = createMadaraAccount(provider, DEPLOYER_ADDRESS, DEPLOYER_PRIVATE_KEY);
  const { playerAccountClassHash, playerRegistryClassHash } = await declareGameplayContracts(account);
  const playerRegistryAddress = resolvePlayerRegistryAddress(playerRegistryClassHash);

  await deployPlayerRegistryIfNeeded(account, playerRegistryClassHash, playerRegistryAddress);

  const result = {
    bindingAuthorityAddress: addAddressPadding(BINDING_AUTHORITY_ADDRESS),
    playerAccountClassHash,
    playerRegistryAddress,
    playerRegistryClassHash,
    rpcUrl: RPC_URL,
  } satisfies GameplayDeploymentResult;
  writeDeploymentResult(result);
  return result;
}

deployGameplayContracts()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
