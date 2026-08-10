import { Account, RpcProvider } from "starknet";
import { loadEnvironmentConfiguration } from "../config/config-loader";
import { resolveDeploymentEnvironment } from "../environment";
import { resolveAccountCredentials } from "../shared/credentials";
import { buildRegisterPresetCalldata, isRegistrarAlreadyRegisteredError, registerPreset } from "./calls";
import { isPresetRegistered } from "./game-registry";
import { buildPresetRegistration, summarizePresetSideTables } from "./preset";

interface RegisterPresetOptions {
  presetId: number;
  environmentId: "appchain.blitz" | "appchain.eternum";
  dryRun: boolean;
}

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseOptions(): RegisterPresetOptions {
  const presetId = Number(readArgument("--preset-id"));
  const environmentId = readArgument("--environment") ?? "appchain.blitz";
  if (!Number.isInteger(presetId) || presetId <= 0) {
    throw new Error(
      "Usage: bun config/deployer/clean/registrar/register-preset.ts --preset-id <n> [--environment appchain.blitz|appchain.eternum] [--dry-run]",
    );
  }
  if (environmentId !== "appchain.blitz" && environmentId !== "appchain.eternum") {
    throw new Error("--environment must be appchain.blitz or appchain.eternum");
  }
  return { presetId, environmentId, dryRun: process.argv.includes("--dry-run") };
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => (typeof entry === "bigint" ? entry.toString() : entry), 2);
}

export function buildPresetDryRun(
  presetId: number,
  environmentId: "appchain.blitz" | "appchain.eternum" = "appchain.blitz",
) {
  const config = loadEnvironmentConfiguration(environmentId);
  const payload = buildPresetRegistration(config, presetId);
  const calldata = buildRegisterPresetCalldata(payload);
  return {
    presetId,
    calldataLength: calldata.length,
    counts: summarizePresetSideTables(payload),
    calldata,
  };
}

export async function registerAppchainPreset(options: RegisterPresetOptions): Promise<void> {
  const config = loadEnvironmentConfiguration(options.environmentId);
  const payload = buildPresetRegistration(config, options.presetId);
  const calldata = buildRegisterPresetCalldata(payload);
  const summary = {
    presetId: options.presetId,
    calldataLength: calldata.length,
    counts: summarizePresetSideTables(payload),
    calldata,
  };

  if (options.dryRun) {
    console.log(stringify(summary));
    return;
  }

  if (await isPresetRegistered(options.presetId).catch(() => false)) {
    console.log(`Preset ${options.presetId} is already registered; skipping.`);
    return;
  }

  const environment = resolveDeploymentEnvironment(options.environmentId);
  const credentials = resolveAccountCredentials({
    accountAddress: process.env.DOJO_ACCOUNT_ADDRESS,
    privateKey: process.env.DOJO_PRIVATE_KEY,
    context: "appchain preset registration",
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
}

if (import.meta.main) {
  registerAppchainPreset(parseOptions()).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
