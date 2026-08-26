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

async function bootstrapRegistrar(params: {
  environmentId: DeploymentEnvironmentId;
  account: Account;
  adminAddress: string;
  entryTokenAddress: string;
  lootChestAddress: string;
  dryRun: boolean;
}): Promise<void> {
  const config = loadEnvironmentConfiguration(params.environmentId);
  const chainConfig = buildChainConfig(config, {
    adminAddress: params.adminAddress,
    vrfProviderAddress: optionalEnvironmentAddress("VRF_PROVIDER_ADDRESS"),
    agentControllerAddress: optionalEnvironmentAddress("AGENT_CONTROLLER_ADDRESS"),
    feeTokenAddress: optionalEnvironmentAddress("FEE_TOKEN_ADDRESS"),
    feeRecipientAddress: optionalEnvironmentAddress("FEE_RECIPIENT_ADDRESS"),
    entryTokenAddress: params.entryTokenAddress,
    cosmeticsAddress: optionalEnvironmentAddress("COSMETICS_ADDRESS"),
    timelockAddress: optionalEnvironmentAddress("TIMELOCK_ADDRESS"),
    lootChestAddress: params.lootChestAddress,
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
  // Phase 1 runs the free-entry flow everywhere: no entry token or loot chest exists, and the
  // collectible role wiring went with it. Refusing a configured address is deliberate — an address
  // this script would silently ignore is worse than a loud stop (entry fees move to the L2 value
  // plane in phase 2; see the brief).
  const entryTokenAddress = optionalEnvironmentAddress("ENTRY_TOKEN_ADDRESS");
  const lootChestAddress = optionalEnvironmentAddress("LOOT_CHEST_ADDRESS");
  if (entryTokenAddress || lootChestAddress) {
    throw new Error(
      "entry-token / collectible addresses are not supported: phase 1 is fee-free and the collectible role wiring was removed",
    );
  }
  const account = new Account({
    provider: new RpcProvider({ nodeUrl: rpcUrl }),
    address: credentials.accountAddress,
    signer: credentials.privateKey,
  });

  await bootstrapRegistrar({
    environmentId,
    account,
    adminAddress: credentials.accountAddress,
    entryTokenAddress: entryTokenAddress ?? "0x0",
    lootChestAddress: lootChestAddress ?? "0x0",
    dryRun,
  });
  await registerEnvironmentPreset({ presetId: resolveDefaultPresetId(environmentId), environmentId, dryRun });
}

deployS2World().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
