import { loadEnvironmentConfiguration } from "../../../config/deployer/clean/config/config-loader";
import { resolveDeploymentEnvironment } from "../../../config/deployer/clean/environment";
import {
  assertRegistrarAvailable,
  bootstrapChainConfig,
  isRegistrarAlreadyInitializedError,
  resolveRegistrarContractAddress,
} from "../../../config/deployer/clean/registrar/calls";
import { isChainConfigInitialized } from "../../../config/deployer/clean/registrar/game-registry";
import { buildChainConfig } from "../../../config/deployer/clean/registrar/preset";
import { registerEnvironmentPreset } from "../../../config/deployer/clean/registrar/register-preset";
import { resolveAccountCredentials } from "../../../config/deployer/clean/shared/credentials";
import { Account, RpcProvider } from "starknet";
import {
  DEFAULT_APPCHAIN_ETERNUM_PRESET_ID,
  DEFAULT_APPCHAIN_PRESET_ID,
  DEFAULT_MADARA_PRESET_ID,
} from "../../../config/deployer/clean/constants";
import type { DeploymentEnvironmentId } from "../../../config/deployer/clean/types";

const ENVIRONMENT_IDS: DeploymentEnvironmentId[] = ["madara.blitz", "appchain.blitz", "appchain.eternum"];

function resolveEnvironmentId(): DeploymentEnvironmentId {
  const index = process.argv.indexOf("--environment");
  const value = index >= 0 ? process.argv[index + 1] : "appchain.blitz";
  if (!ENVIRONMENT_IDS.includes(value as DeploymentEnvironmentId)) {
    throw new Error(`--environment must be one of: ${ENVIRONMENT_IDS.join(", ")}`);
  }
  return value as DeploymentEnvironmentId;
}

// Blitz preset 2 = Regular Fast (launch default; preset 1 is retired);
// eternum preset 10 = the standard eternum season.
function resolveDefaultPresetId(environmentId: DeploymentEnvironmentId): number {
  if (environmentId === "madara.blitz") return Number(DEFAULT_MADARA_PRESET_ID);
  return Number(environmentId === "appchain.eternum" ? DEFAULT_APPCHAIN_ETERNUM_PRESET_ID : DEFAULT_APPCHAIN_PRESET_ID);
}

function optionalEnvironmentAddress(name: string): string | undefined {
  const address = process.env[name];
  return address && BigInt(address) !== 0n ? address : undefined;
}

function requiredEnvironmentAddress(name: string): string {
  const address = optionalEnvironmentAddress(name);
  if (!address) throw new Error(`${name} must be a non-zero contract address`);
  return address;
}

async function bootstrapRegistrar(params: {
  environmentId: DeploymentEnvironmentId;
  account: Account;
  adminAddress: string;
  ledgerOperatorAddress: string;
  playerRegistryAddress: string;
  dryRun: boolean;
}): Promise<void> {
  const config = loadEnvironmentConfiguration(params.environmentId);
  const chainConfig = buildChainConfig(config, {
    adminAddress: params.adminAddress,
    ledgerOperatorAddress: params.ledgerOperatorAddress,
    playerRegistryAddress: params.playerRegistryAddress,
    vrfProviderAddress: optionalEnvironmentAddress("VRF_PROVIDER_ADDRESS"),
    agentControllerAddress: optionalEnvironmentAddress("AGENT_CONTROLLER_ADDRESS"),
    cosmeticsAddress: optionalEnvironmentAddress("COSMETICS_ADDRESS"),
    timelockAddress: optionalEnvironmentAddress("TIMELOCK_ADDRESS"),
    lootChestAddress: optionalEnvironmentAddress("LOOT_CHEST_ADDRESS"),
    eliteNftAddress: optionalEnvironmentAddress("ELITE_NFT_ADDRESS"),
  });

  if (params.dryRun) {
    console.log("Prepared registrar chain configuration.");
    return;
  }
  // isChainConfigInitialized reads whichever torii TORII_URL points at, which
  // is NOT world-scoped: bootstrapping the eternum world with TORII_URL still
  // aimed at torii-s2 (blitz) would false-skip. Leave TORII_URL unset (or aim
  // it at this world's torii) — the catch falls through to the on-chain
  // already-initialized guard, which is the real idempotency check.
  if (await isChainConfigInitialized().catch(() => false)) {
    console.log("ChainConfig is already initialized; skipping bootstrap.");
    return;
  }

  try {
    const result = await bootstrapChainConfig(params.account, chainConfig, params.environmentId);
    console.log(`Bootstrapped ChainConfig: ${result.transactionHash}`);
  } catch (error) {
    if (!isRegistrarAlreadyInitializedError(error)) {
      throw error;
    }
    console.log("ChainConfig is already initialized; skipping bootstrap.");
  }
}

async function deployS2World(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const environmentId = resolveEnvironmentId();
  const sozoProfile =
    environmentId === "madara.blitz"
      ? "madara"
      : environmentId === "appchain.eternum"
        ? "appchain-eternum"
        : "appchain-blitz";
  console.log(
    `World migration is reviewer-owned. Run: sozo build --profile ${sozoProfile} && sozo migrate --profile ${sozoProfile}`,
  );
  assertRegistrarAvailable(environmentId);

  const environment = resolveDeploymentEnvironment(environmentId);
  const rpcUrl = process.env.RPC_URL || environment.rpcUrl;
  const credentials = resolveAccountCredentials({
    accountAddress: process.env.DOJO_ACCOUNT_ADDRESS,
    privateKey: process.env.DOJO_PRIVATE_KEY,
    context: `${environmentId} deployment`,
  });
  const account = new Account({
    provider: new RpcProvider({ nodeUrl: rpcUrl }),
    address: credentials.accountAddress,
    signer: credentials.privateKey,
  });

  await bootstrapRegistrar({
    environmentId,
    account,
    adminAddress: credentials.accountAddress,
    ledgerOperatorAddress: requiredEnvironmentAddress("LEDGER_OPERATOR_ADDRESS"),
    playerRegistryAddress: requiredEnvironmentAddress("PLAYER_REGISTRY_ADDRESS"),
    dryRun,
  });
  await registerEnvironmentPreset({ presetId: resolveDefaultPresetId(environmentId), environmentId, dryRun });
}

deployS2World().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
