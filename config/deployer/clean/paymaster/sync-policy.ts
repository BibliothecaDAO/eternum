import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { getConfigFromNetwork, type Chain } from "../../../utils/utils";
import { DEFAULT_CARTRIDGE_API_BASE } from "../constants";
import { patchManifestWithFactory, resolveFactoryWorldProfile } from "../factory/discovery";
import { ensureRepoDirectory, loadRepoJsonFile } from "../shared/repo";

interface WorldManifestLike {
  address?: string;
  entrypoints?: string[];
}

interface ContractManifestLike {
  address?: string;
  selector?: string;
  systems?: string[];
}

interface PaymasterManifestLike {
  world?: WorldManifestLike;
  contracts?: ContractManifestLike[];
}

export interface PaymasterAction {
  contractAddress: string;
  entrypoint: string;
}

export interface SyncPaymasterPolicyOptions {
  chain: string;
  gameName: string;
  paymasterName?: string;
  dryRun?: boolean;
  autoConfirm?: boolean;
  cartridgeApiBase?: string;
  vrfProviderAddress?: string;
  applyPolicy?: (paymasterName: string, filePath: string, autoConfirm?: boolean) => void;
}

export interface SyncPaymasterPolicyResult {
  chain: Chain;
  gameName: string;
  paymasterName: string;
  actionCount: number;
  outputPath: string;
  dryRun: boolean;
  updated: boolean;
}

const PAYMASTER_OUTPUT_DIRECTORY = ".context/paymaster";
const SLOT_COMMAND_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

const strip0x = (value: string) => (value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value);

function isZeroAddress(value?: string | null): boolean {
  if (!value) {
    return true;
  }

  return /^0+$/.test(strip0x(value));
}

function resolveSupportedChain(chain: string): Chain {
  switch (chain) {
    case "local":
    case "mainnet":
    case "sepolia":
    case "slot":
    case "slottest":
      return chain;
    default:
      throw new Error(`Unsupported chain "${chain}"`);
  }
}

function resolvePaymasterName(options: SyncPaymasterPolicyOptions): string {
  return options.paymasterName || "empire";
}

function resolvePaymasterCartridgeApiBase(options: SyncPaymasterPolicyOptions): string {
  return options.cartridgeApiBase || DEFAULT_CARTRIDGE_API_BASE;
}

function resolvePaymasterAutoConfirm(options: SyncPaymasterPolicyOptions): boolean {
  return options.autoConfirm === true || process.env.CI === "true";
}

function resolvePaymasterManifestPath(chain: Chain): string {
  return `contracts/game/manifest_${chain}.json`;
}

function loadPaymasterManifest(chain: Chain): PaymasterManifestLike {
  return loadRepoJsonFile<PaymasterManifestLike>(resolvePaymasterManifestPath(chain));
}

function resolvePaymasterVrfProviderAddress(options: SyncPaymasterPolicyOptions, chain: Chain): string | undefined {
  if (options.vrfProviderAddress) {
    return options.vrfProviderAddress;
  }

  const config = getConfigFromNetwork(chain, "eternum") as { vrf?: { vrfProviderAddress?: string } };
  return config.vrf?.vrfProviderAddress;
}

async function loadPatchedPaymasterManifest(
  options: SyncPaymasterPolicyOptions,
  chain: Chain,
): Promise<PaymasterManifestLike> {
  const worldProfile = await resolveFactoryWorldProfile(
    chain,
    options.gameName,
    resolvePaymasterCartridgeApiBase(options),
  );

  if (!worldProfile) {
    throw new Error(`Could not resolve factory deployment for "${options.gameName}" on "${chain}"`);
  }

  return patchManifestWithFactory(
    loadPaymasterManifest(chain),
    worldProfile.worldAddress,
    worldProfile.contractsBySelector,
  ) as PaymasterManifestLike;
}

function addPaymasterAction(
  actionsByKey: Map<string, PaymasterAction>,
  contractAddress?: string,
  entrypoint?: string,
): void {
  if (!contractAddress || !entrypoint) {
    return;
  }

  const key = `${contractAddress.toLowerCase()}:${entrypoint}`;
  if (!actionsByKey.has(key)) {
    actionsByKey.set(key, { contractAddress, entrypoint });
  }
}

function buildPaymasterActions(manifest: PaymasterManifestLike, vrfProviderAddress?: string): PaymasterAction[] {
  const actionsByKey = new Map<string, PaymasterAction>();

  if (manifest.world?.address && Array.isArray(manifest.world.entrypoints)) {
    for (const entrypoint of manifest.world.entrypoints) {
      addPaymasterAction(actionsByKey, manifest.world.address, entrypoint);
    }
  }

  if (Array.isArray(manifest.contracts)) {
    for (const contract of manifest.contracts) {
      if (!contract?.address || !Array.isArray(contract.systems)) {
        continue;
      }

      for (const entrypoint of contract.systems) {
        addPaymasterAction(actionsByKey, contract.address, entrypoint);
      }
    }
  }

  if (vrfProviderAddress && !isZeroAddress(vrfProviderAddress)) {
    addPaymasterAction(actionsByKey, vrfProviderAddress, "request_random");
  }

  return Array.from(actionsByKey.values());
}

function formatPaymasterOutputFilename(chain: Chain, gameName: string): string {
  const safeGameName = gameName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `eternum-actions-${chain}-${safeGameName || "world"}.json`;
}

function writePaymasterActionsFile(chain: Chain, gameName: string, actions: PaymasterAction[]): string {
  const outputDirectory = ensureRepoDirectory(PAYMASTER_OUTPUT_DIRECTORY);
  const outputPath = path.resolve(outputDirectory, formatPaymasterOutputFilename(chain, gameName));
  fs.writeFileSync(outputPath, `${JSON.stringify(actions, null, 2)}\n`);
  return outputPath;
}

function runSlotPaymasterPolicyCommand(
  paymasterName: string,
  filePath: string,
  autoConfirm = false,
): SpawnSyncReturns<string> {
  return spawnSync("slot", ["paymaster", paymasterName, "policy", "add-from-json", "--file", filePath], {
    encoding: "utf8",
    input: autoConfirm ? "y\n" : undefined,
    stdio: autoConfirm ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
    maxBuffer: SLOT_COMMAND_MAX_BUFFER_BYTES,
  });
}

function normalizeCapturedOutput(output: string | null | undefined): string {
  return `${output || ""}`.trim();
}

function writeCapturedOutput(stream: NodeJS.WriteStream, output: string | null | undefined): void {
  const normalizedOutput = normalizeCapturedOutput(output);
  if (!normalizedOutput) {
    return;
  }

  stream.write(`${normalizedOutput}\n`);
}

function relaySlotCommandOutput(result: SpawnSyncReturns<string>): void {
  writeCapturedOutput(process.stdout, result.stdout);
  writeCapturedOutput(process.stderr, result.stderr);
}

function buildSlotCommandFailureMessage(result: SpawnSyncReturns<string>): string {
  const exitCode = result.status ?? 1;
  const output = [normalizeCapturedOutput(result.stderr), normalizeCapturedOutput(result.stdout)]
    .filter(Boolean)
    .join("\n");

  if (!output) {
    return `slot command failed with exit code ${exitCode}`;
  }

  return `slot command failed with exit code ${exitCode}: ${output}`;
}

function executeSlotPaymasterPolicyUpdate(paymasterName: string, filePath: string, autoConfirm = false): void {
  const result = runSlotPaymasterPolicyCommand(paymasterName, filePath, autoConfirm);

  if (result.error) {
    throw new Error(`Failed to execute slot CLI: ${result.error.message}`);
  }

  const exitCode = result.status ?? 1;
  if (exitCode !== 0) {
    throw new Error(buildSlotCommandFailureMessage(result));
  }

  relaySlotCommandOutput(result);
}

export async function syncPaymasterPolicy(options: SyncPaymasterPolicyOptions): Promise<SyncPaymasterPolicyResult> {
  const chain = resolveSupportedChain(options.chain);
  const paymasterName = resolvePaymasterName(options);
  const dryRun = options.dryRun === true;
  const autoConfirm = resolvePaymasterAutoConfirm(options);
  const manifest = await loadPatchedPaymasterManifest(options, chain);
  const actions = buildPaymasterActions(manifest, resolvePaymasterVrfProviderAddress(options, chain));

  if (!actions.length) {
    throw new Error("No paymaster actions were generated");
  }

  const outputPath = writePaymasterActionsFile(chain, options.gameName, actions);

  if (!dryRun) {
    (options.applyPolicy || executeSlotPaymasterPolicyUpdate)(paymasterName, outputPath, autoConfirm);
  }

  return {
    chain,
    gameName: options.gameName,
    paymasterName,
    actionCount: actions.length,
    outputPath,
    dryRun,
    updated: !dryRun,
  };
}
