#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addAddressPadding, hash, RpcProvider } from "starknet";

const LAB_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(LAB_DIRECTORY, "../..");
const CONTRACT_DIRECTORY = resolve(REPOSITORY_ROOT, "contracts/l3/player-account");
const ARTIFACT_DIRECTORY = resolve(CONTRACT_DIRECTORY, "target/dev");
const OUTPUT_PATH = resolve(LAB_DIRECTORY, ".lab/gameplay-contracts.json");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:5050/rpc/v0_9_0";
const DEPLOYER_ADDRESS =
  process.env.DOJO_ACCOUNT_ADDRESS || "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d";
const DEPLOYER_PRIVATE_KEY =
  process.env.DOJO_PRIVATE_KEY || "0x077e56c6dc32d40a67f6f7e6625c8dc5e570abe49c0a24e9202e4ae906abcc07";
const BINDING_AUTHORITY_ADDRESS =
  process.env.BINDING_AUTHORITY_ADDRESS ||
  "0x008a1719e7ca19f3d91e8ef50a48fc456575f645497a1d55f30e3781f786afe4";

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
    env: { ...process.env, ASDF_SOZO_VERSION: process.env.ASDF_SOZO_VERSION || "1.8.7" },
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

function readClassHash(artifactName: string): string {
  const contractClass = JSON.parse(readFileSync(resolve(ARTIFACT_DIRECTORY, artifactName), "utf8"));
  return addAddressPadding(hash.computeContractClassHash(contractClass));
}

function declareGameplayContracts(): void {
  runCommand(
    "sozo",
    [
      "declare",
      resolve(ARTIFACT_DIRECTORY, PLAYER_ACCOUNT_ARTIFACT),
      resolve(ARTIFACT_DIRECTORY, PLAYER_REGISTRY_ARTIFACT),
      "--rpc-url",
      RPC_URL,
      "--account-address",
      DEPLOYER_ADDRESS,
      "--private-key",
      DEPLOYER_PRIVATE_KEY,
      "--use-blake2s-casm-class-hash",
      "--wait",
    ],
    CONTRACT_DIRECTORY,
  );
}

function resolvePlayerRegistryAddress(classHash: string): string {
  return addAddressPadding(
    hash.calculateContractAddressFromHash("0x0", classHash, [BINDING_AUTHORITY_ADDRESS], "0x0"),
  );
}

function rpcErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const value = error as { code?: unknown; baseError?: { code?: unknown }; error?: { code?: unknown } };
  const code = value.code ?? value.baseError?.code ?? value.error?.code;
  return typeof code === "number" ? code : undefined;
}

async function isExpectedContractDeployed(
  provider: RpcProvider,
  address: string,
  classHash: string,
): Promise<boolean> {
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

async function deployPlayerRegistryIfNeeded(
  provider: RpcProvider,
  classHash: string,
  address: string,
): Promise<void> {
  if (await isExpectedContractDeployed(provider, address, classHash)) {
    return;
  }

  runCommand(
    "sozo",
    [
      "deploy",
      classHash,
      "--constructor-calldata",
      BINDING_AUTHORITY_ADDRESS,
      "--rpc-url",
      RPC_URL,
      "--account-address",
      DEPLOYER_ADDRESS,
      "--private-key",
      DEPLOYER_PRIVATE_KEY,
      "--use-blake2s-casm-class-hash",
      "--wait",
    ],
    CONTRACT_DIRECTORY,
  );

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
  buildGameplayContracts();
  const playerAccountClassHash = readClassHash(PLAYER_ACCOUNT_ARTIFACT);
  const playerRegistryClassHash = readClassHash(PLAYER_REGISTRY_ARTIFACT);
  const playerRegistryAddress = resolvePlayerRegistryAddress(playerRegistryClassHash);

  declareGameplayContracts();
  await deployPlayerRegistryIfNeeded(new RpcProvider({ nodeUrl: RPC_URL }), playerRegistryClassHash, playerRegistryAddress);

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
