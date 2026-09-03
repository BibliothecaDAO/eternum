import { loadEnvironmentConfiguration } from "../../../config/deployer/clean/config/config-loader";
import { resolveDeploymentEnvironment } from "../../../config/deployer/clean/environment";
import {
  assertRegistrarAvailable,
  bootstrapChainConfig,
  isRegistrarAlreadyInitializedError,
  resolveRegistrarContractAddress,
} from "../../../config/deployer/clean/registrar/calls";
import { buildChainConfig } from "../../../config/deployer/clean/registrar/preset";
import { registerEnvironmentPreset } from "../../../config/deployer/clean/registrar/register-preset";
import { resolveAccountCredentials } from "../../../config/deployer/clean/shared/credentials";
import { requireRpcUrl } from "../../../config/deployer/clean/shared/rpc";
import { Account, RpcProvider } from "starknet";
// Relative, not the "@realms-world/chain" specifier: deploy/madara-lab is not a workspace package, so pnpm never
// links the workspace package here — bun only resolves it inside apps/* and packages/* that declare the dep.
// chain-guard.js is plain ESM (no build step), matching how the other madara-lab scripts import shared code.
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import { DEFAULT_MADARA_PRESET_ID, DEPLOYMENT_ENVIRONMENTS } from "../../../config/deployer/clean/constants";
import { isDeploymentEnvironmentId } from "../../../config/deployer/clean/environment";
import type { DeploymentEnvironmentId } from "../../../config/deployer/clean/types";

function resolveEnvironmentId(): DeploymentEnvironmentId {
  const index = process.argv.indexOf("--environment");
  const value = index >= 0 ? process.argv[index + 1] : "madara.blitz";
  if (!isDeploymentEnvironmentId(value)) {
    throw new Error(`--environment must be one of: ${Object.keys(DEPLOYMENT_ENVIRONMENTS).join(", ")}`);
  }
  return value;
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
  // Idempotency is the on-chain guard below: bootstrap_chain_config is write-once and reverts with an
  // already-initialized error on re-run, which we catch. (The former Torii-based pre-check was deleted with Torii.)
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
  console.log("World migration is reviewer-owned. Run: sozo build --profile madara && sozo migrate --profile madara");
  assertRegistrarAvailable(environmentId);

  const environment = resolveDeploymentEnvironment(environmentId);
  const rpcUrl = requireRpcUrl(process.env.RPC_URL, "RPC_URL");
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  if (!dryRun) {
    await assertProviderChain(provider, environment.chain, "RPC_URL");
  }
  const credentials = resolveAccountCredentials({
    accountAddress: process.env.DOJO_ACCOUNT_ADDRESS,
    privateKey: process.env.DOJO_PRIVATE_KEY,
    context: `${environmentId} deployment`,
  });
  const account = new Account({
    provider,
    address: credentials.accountAddress,
    signer: credentials.privateKey,
  });

  await bootstrapRegistrar({
    environmentId,
    account,
    adminAddress: credentials.accountAddress,
    ledgerOperatorAddress: requiredEnvironmentAddress("S2_OPERATOR_ADDRESS"),
    playerRegistryAddress: requiredEnvironmentAddress("PLAYER_REGISTRY_ADDRESS"),
    dryRun,
  });
  await registerEnvironmentPreset({
    presetId: Number(DEFAULT_MADARA_PRESET_ID),
    environmentId,
    rpcUrl,
    sponsored: false,
    dryRun,
  });
}

deployS2World().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
