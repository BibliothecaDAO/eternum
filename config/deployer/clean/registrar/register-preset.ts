import { writeFileSync } from "node:fs";
import { nativePresetForId } from "../../../source/native";
import { buildNativePreset } from "../config/native-preset";
import { RpcProvider } from "starknet";
import { createOperatorAccount } from "../shared/madara-account";
import { readShardManifest } from "@realms-world/chain/shard-manifest";
import { assertProviderChain } from "@realms-world/chain";
import { DEPLOYMENT_ENVIRONMENTS } from "../constants";
import { isDeploymentEnvironmentId } from "../environment";
import { createLedgerAdminAccount, registerLedgerPreset, type LedgerTarget } from "../ledger/calls";
import { buildLedgerEconomicPreset, buildRegisterLedgerPresetCalldata } from "../ledger/economics";
import { resolveAccountCredentials } from "../shared/credentials";
import { requireRpcUrl } from "../shared/rpc";
import type { DeploymentEnvironmentId } from "../types";
import { buildNativePresetRegistration, registerNativePreset, loadNativePresetConfiguration } from "./native-preset";

interface RegisterPresetOptions {
  presetId: number;
  environmentId: DeploymentEnvironmentId;
  rpcUrl?: string;
  ledgerAddress?: string;
  ledgerRpcUrl?: string;
  sponsored: boolean;
  dryRun: boolean;
  nativeManifest: string;
  record?: string;
}

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseOptions(): RegisterPresetOptions {
  const presetId = Number(readArgument("--preset-id"));
  if (!Number.isInteger(presetId) || presetId <= 0) {
    throw new Error(
      "Usage: bun config/deployer/clean/registrar/register-preset.ts --preset-id <n> [--ledger <address> --ledger-rpc-url <mainnet RPC>] [--environment madara.<mode>] [--native-manifest path] [--record path] [--sponsored] [--dry-run]",
    );
  }
  // The preset's own mode names its configuration unless an environment is given.
  const environmentId = readArgument("--environment") ?? `madara.${nativePresetForId(presetId).gameType}`;
  if (!isDeploymentEnvironmentId(environmentId)) {
    throw new Error(`--environment must be one of: ${Object.keys(DEPLOYMENT_ENVIRONMENTS).join(", ")}`);
  }
  return {
    presetId,
    environmentId,
    rpcUrl: readArgument("--rpc-url") || process.env.RPC_URL,
    ledgerAddress: readArgument("--ledger") || process.env.LEDGER_ADDRESS,
    ledgerRpcUrl: readArgument("--ledger-rpc-url") || process.env.LEDGER_RPC_URL,
    sponsored: process.argv.includes("--sponsored"),
    dryRun: process.argv.includes("--dry-run"),
    nativeManifest: requiredManifest(),
    record: readArgument("--record"),
  };
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => (typeof entry === "bigint" ? entry.toString() : entry), 2);
}

// The ledger is the L2 value plane. A dev-mode lab with L2 deferred registers only the L3 registrar preset;
// give it both LEDGER_ADDRESS and LEDGER_RPC_URL and the L2 economic preset is registered too. Neither set → skip.
function resolveOptionalLedgerTarget(options: RegisterPresetOptions): LedgerTarget | undefined {
  if (!options.ledgerAddress && !options.ledgerRpcUrl) return undefined;
  if (!options.ledgerAddress || !options.ledgerRpcUrl) {
    throw new Error("LEDGER_ADDRESS and LEDGER_RPC_URL (--ledger / --ledger-rpc-url) must be set together");
  }
  return { address: options.ledgerAddress, rpcUrl: options.ledgerRpcUrl };
}

export async function registerEnvironmentPreset(options: RegisterPresetOptions): Promise<void> {
  const config = loadNativePresetConfiguration(options.environmentId, options.presetId);
  const registration = buildRegistration(config, options);
  const { calldata } = registration;
  const ledgerPreset = buildLedgerEconomicPreset(nativePresetForId(options.presetId).gameType, {
    sponsored: options.sponsored,
  });
  const summary = {
    presetId: options.presetId,
    calldataLength: calldata.length,
    ...registration.summary,
    sponsored: options.sponsored,
    calldata,
    ledgerCalldata: buildRegisterLedgerPresetCalldata(options.presetId, ledgerPreset),
  };

  if (options.dryRun) {
    console.log(stringify(summary));
    return;
  }

  const ledgerTarget = resolveOptionalLedgerTarget(options);
  const provider = new RpcProvider({ nodeUrl: requireRpcUrl(options.rpcUrl, "--rpc-url or RPC_URL") });
  await Promise.all([
    assertProviderChain(provider, readShardManifest(options.nativeManifest), "RPC_URL"),
    ...(ledgerTarget
      ? [assertProviderChain(new RpcProvider({ nodeUrl: ledgerTarget.rpcUrl }), "mainnet", "LEDGER_RPC_URL")]
      : []),
  ]);
  const credentials = resolveAccountCredentials({
    accountAddress: process.env.DEPLOYER_ACCOUNT_ADDRESS,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY,
    context: `${options.environmentId} preset registration`,
  });
  const account = createOperatorAccount(provider, credentials.accountAddress, credentials.privateKey);

  const transaction = await registerNativePreset(account, options.presetId, registration.native);
  console.log(
    transaction
      ? `Registered native preset ${options.presetId}: ${transaction}`
      : `Native preset ${options.presetId} is unchanged.`,
  );
  if (options.record) await recordChainCommitment(account, options.presetId, registration.native, options.record);

  if (!ledgerTarget) {
    console.log(`No ledger configured; skipping ledger preset ${options.presetId} (L2 deferred).`);
    return;
  }
  const ledgerAccount = createLedgerAdminAccount(ledgerTarget, "mainnet ledger preset registration");
  const ledgerResult = await registerLedgerPreset(ledgerAccount, ledgerTarget, options.presetId, ledgerPreset);
  console.log(
    ledgerResult
      ? `Registered ledger preset ${options.presetId}: ${ledgerResult.transactionHash}`
      : `Ledger preset ${options.presetId} is already registered; skipping.`,
  );
}

/** Record the commitment the chain now holds for the preset, read back rather than assumed. */
async function recordChainCommitment(
  account: ReturnType<typeof createOperatorAccount>,
  presetId: number,
  registration: ReturnType<typeof buildNativePresetRegistration>,
  path: string,
) {
  const [commitment] = await account.callContract({
    contractAddress: registration.address,
    entrypoint: registration.commitmentView,
    calldata: [presetId],
  });
  writeFileSync(path, JSON.stringify({ presetId, commitment }) + "\n");
}

function buildRegistration(config: ReturnType<typeof loadNativePresetConfiguration>, options: RegisterPresetOptions) {
  const native = buildNativePresetRegistration(
    buildNativePreset(config, options.presetId),
    options.presetId,
    options.nativeManifest,
  );
  return {
    native,
    calldata: native.calldata,
    summary: { nativeRegistrar: native.address, commitment: native.commitment },
  };
}

function requiredManifest(): string {
  const path = readArgument("--native-manifest") ?? process.env.NATIVE_WORLD_MANIFEST;
  if (!path) throw new Error("NATIVE_WORLD_MANIFEST is required");
  return path;
}

if (import.meta.main) {
  registerEnvironmentPreset(parseOptions()).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
