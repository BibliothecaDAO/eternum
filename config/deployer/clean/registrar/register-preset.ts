import { Account, RpcProvider } from "starknet";
import { applyBlitzBalanceProfile, type BlitzBalanceProfileId } from "../../../source/blitz";
import { loadEnvironmentConfiguration } from "../config/config-loader";
import { resolveDeploymentEnvironment } from "../environment";
import { createLedgerAdminAccount, registerLedgerPreset, type LedgerTarget } from "../ledger/calls";
import { buildLedgerEconomicPreset, buildRegisterLedgerPresetCalldata } from "../ledger/economics";
import { resolveAccountCredentials } from "../shared/credentials";
import type { DeploymentEnvironmentId } from "../types";
import { buildRegisterPresetCalldata, isRegistrarAlreadyRegisteredError, registerPreset } from "./calls";
import { buildPresetRegistration, summarizePresetSideTables } from "./preset";

interface RegisterPresetOptions {
  presetId: number;
  environmentId: DeploymentEnvironmentId;
  balanceProfile?: BlitzBalanceProfileId;
  ledgerAddress?: string;
  ledgerRpcUrl?: string;
  sponsored: boolean;
  dryRun: boolean;
}

const BALANCE_PROFILE_IDS: BlitzBalanceProfileId[] = ["official-60", "official-90"];

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseOptions(): RegisterPresetOptions {
  const presetId = Number(readArgument("--preset-id"));
  const environmentId = readArgument("--environment") ?? "appchain.blitz";
  const balanceProfile = readArgument("--balance-profile") as BlitzBalanceProfileId | undefined;
  if (!Number.isInteger(presetId) || presetId <= 0) {
    throw new Error(
      "Usage: bun config/deployer/clean/registrar/register-preset.ts --preset-id <n> --ledger <address> --ledger-rpc-url <mainnet RPC> [--environment madara.blitz|appchain.blitz|appchain.eternum] [--balance-profile official-60|official-90] [--sponsored] [--dry-run]",
    );
  }
  if (environmentId !== "madara.blitz" && environmentId !== "appchain.blitz" && environmentId !== "appchain.eternum") {
    throw new Error("--environment must be madara.blitz, appchain.blitz, or appchain.eternum");
  }
  if (balanceProfile !== undefined) {
    if (!BALANCE_PROFILE_IDS.includes(balanceProfile)) {
      throw new Error(`--balance-profile must be one of: ${BALANCE_PROFILE_IDS.join(", ")}`);
    }
    if (environmentId !== "appchain.blitz") {
      throw new Error("--balance-profile only applies to appchain.blitz");
    }
  }
  return {
    presetId,
    environmentId,
    balanceProfile,
    ledgerAddress: readArgument("--ledger") || process.env.LEDGER_ADDRESS,
    ledgerRpcUrl: readArgument("--ledger-rpc-url") || process.env.LEDGER_RPC_URL,
    sponsored: process.argv.includes("--sponsored"),
    dryRun: process.argv.includes("--dry-run"),
  };
}

// The stored environment JSON is the raw base sheet: balance profiles
// (official-60 "Regular Fast", official-90) are applied at game creation,
// NOT baked into the stored config. A preset registered without the profile
// silently ships base balance under a profile-flavored label (preset 4 bug).
function loadPresetConfiguration(environmentId: DeploymentEnvironmentId, balanceProfile?: BlitzBalanceProfileId) {
  const config = loadEnvironmentConfiguration(environmentId);
  return balanceProfile ? applyBlitzBalanceProfile(config, balanceProfile) : config;
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => (typeof entry === "bigint" ? entry.toString() : entry), 2);
}

export function buildPresetDryRun(
  presetId: number,
  environmentId: DeploymentEnvironmentId = "appchain.blitz",
  balanceProfile?: BlitzBalanceProfileId,
  sponsored = false,
) {
  const config = loadPresetConfiguration(environmentId, balanceProfile);
  const payload = buildPresetRegistration(config, presetId);
  const calldata = buildRegisterPresetCalldata(payload);
  const ledgerPreset = buildLedgerEconomicPreset(resolveDeploymentEnvironment(environmentId).gameType, { sponsored });
  return {
    presetId,
    balanceProfile: balanceProfile ?? null,
    sponsored,
    calldataLength: calldata.length,
    counts: summarizePresetSideTables(payload),
    calldata,
    ledgerCalldata: buildRegisterLedgerPresetCalldata(presetId, ledgerPreset),
  };
}

function requireLedgerTarget(options: RegisterPresetOptions): LedgerTarget {
  if (!options.ledgerAddress || !options.ledgerRpcUrl) {
    throw new Error("--ledger and --ledger-rpc-url (or LEDGER_ADDRESS and LEDGER_RPC_URL) are required");
  }
  return { address: options.ledgerAddress, rpcUrl: options.ledgerRpcUrl };
}

export async function registerEnvironmentPreset(options: RegisterPresetOptions): Promise<void> {
  const config = loadPresetConfiguration(options.environmentId, options.balanceProfile);
  const payload = buildPresetRegistration(config, options.presetId);
  const calldata = buildRegisterPresetCalldata(payload);
  const ledgerPreset = buildLedgerEconomicPreset(resolveDeploymentEnvironment(options.environmentId).gameType, {
    sponsored: options.sponsored,
  });
  const summary = {
    presetId: options.presetId,
    calldataLength: calldata.length,
    counts: summarizePresetSideTables(payload),
    sponsored: options.sponsored,
    calldata,
    ledgerCalldata: buildRegisterLedgerPresetCalldata(options.presetId, ledgerPreset),
  };

  if (options.dryRun) {
    console.log(stringify(summary));
    return;
  }

  const ledgerTarget = requireLedgerTarget(options);
  const environment = resolveDeploymentEnvironment(options.environmentId);
  const credentials = resolveAccountCredentials({
    accountAddress: process.env.DOJO_ACCOUNT_ADDRESS,
    privateKey: process.env.DOJO_PRIVATE_KEY,
    context: `${options.environmentId} preset registration`,
  });
  const account = new Account({
    provider: new RpcProvider({ nodeUrl: process.env.RPC_URL || environment.rpcUrl }),
    address: credentials.accountAddress,
    signer: credentials.privateKey,
  });

  try {
    const result = await registerPreset(account, payload, options.environmentId);
    console.log(`Registered preset ${options.presetId}: ${result.transactionHash}`);
  } catch (error) {
    if (!isRegistrarAlreadyRegisteredError(error)) {
      throw error;
    }
    console.log(`Preset ${options.presetId} is already registered; skipping.`);
  }

  const ledgerAccount = createLedgerAdminAccount(ledgerTarget, "mainnet ledger preset registration");
  const ledgerResult = await registerLedgerPreset(ledgerAccount, ledgerTarget, options.presetId, ledgerPreset);
  console.log(
    ledgerResult
      ? `Registered ledger preset ${options.presetId}: ${ledgerResult.transactionHash}`
      : `Ledger preset ${options.presetId} is already registered; skipping.`,
  );
}

if (import.meta.main) {
  registerEnvironmentPreset(parseOptions()).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
