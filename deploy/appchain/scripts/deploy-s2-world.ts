import { loadEnvironmentConfiguration } from "../../../config/deployer/clean/config/config-loader";
import { resolveDeploymentEnvironment } from "../../../config/deployer/clean/environment";
import { MINTER_ROLE } from "../../../config/deployer/clean/eternum/roles";
import {
  assertAppchainRegistrarAvailable,
  bootstrapChainConfig,
  isRegistrarAlreadyInitializedError,
  resolveAppchainContractAddress,
} from "../../../config/deployer/clean/registrar/calls";
import { isChainConfigInitialized } from "../../../config/deployer/clean/registrar/game-registry";
import { buildChainConfig } from "../../../config/deployer/clean/registrar/preset";
import { registerAppchainPreset } from "../../../config/deployer/clean/registrar/register-preset";
import { buildGrantRoleCall, grantRoles } from "../../../config/deployer/clean/role-grants/grant-role";
import { resolveAccountCredentials } from "../../../config/deployer/clean/shared/credentials";
import { Account, RpcProvider } from "starknet";

// Regular Fast — the default launch preset (frozen mapping; preset 1 is retired).
const PRESET_ID = 2;

function optionalEnvironmentAddress(name: string): string | undefined {
  const address = process.env[name];
  return address && BigInt(address) !== 0n ? address : undefined;
}

async function wireSharedCollectibles(params: {
  rpcUrl: string;
  accountAddress: string;
  privateKey: string;
  entryTokenAddress: string;
  lootChestAddress: string;
  dryRun: boolean;
}): Promise<void> {
  const calls = [
    buildGrantRoleCall(
      params.entryTokenAddress,
      MINTER_ROLE,
      resolveAppchainContractAddress("blitz_realm_systems"),
    ),
    buildGrantRoleCall(
      params.lootChestAddress,
      MINTER_ROLE,
      resolveAppchainContractAddress("prize_distribution_systems"),
    ),
  ];
  const result = await grantRoles({
    chain: "appchain",
    calls,
    rpcUrl: params.rpcUrl,
    accountAddress: params.accountAddress,
    privateKey: params.privateKey,
    context: "s2 appchain peripheral wiring",
    dryRun: params.dryRun,
  });
  console.log(
    params.dryRun
      ? `Prepared ${calls.length} shared collectible role grants.`
      : `Wired shared collectible roles: ${result.transactionHash}`,
  );
}

async function bootstrapRegistrar(params: {
  account: Account;
  adminAddress: string;
  entryTokenAddress: string;
  lootChestAddress: string;
  dryRun: boolean;
}): Promise<void> {
  const config = loadEnvironmentConfiguration("appchain.blitz");
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
  if (await isChainConfigInitialized().catch(() => false)) {
    console.log("ChainConfig is already initialized; skipping bootstrap.");
    return;
  }

  try {
    const result = await bootstrapChainConfig(params.account, chainConfig);
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
  console.log(
    "World migration is reviewer-owned. Run: sozo build --profile appchain-blitz && sozo migrate --profile appchain-blitz",
  );
  assertAppchainRegistrarAvailable();

  const environment = resolveDeploymentEnvironment("appchain.blitz");
  const rpcUrl = process.env.RPC_URL || environment.rpcUrl;
  const credentials = resolveAccountCredentials({
    accountAddress: process.env.DOJO_ACCOUNT_ADDRESS,
    privateKey: process.env.DOJO_PRIVATE_KEY,
    context: "s2 appchain deployment",
  });
  // Dev chains run the free-entry flow (amendment S3): no entry token or
  // loot chest exists until the W6 gateway, so both are optional and their
  // collectible role wiring is skipped when absent. Real-value chains must
  // set both.
  const entryTokenAddress = optionalEnvironmentAddress("ENTRY_TOKEN_ADDRESS");
  const lootChestAddress = optionalEnvironmentAddress("LOOT_CHEST_ADDRESS");
  const account = new Account({
    provider: new RpcProvider({ nodeUrl: rpcUrl }),
    address: credentials.accountAddress,
    signer: credentials.privateKey,
  });

  if (entryTokenAddress && lootChestAddress) {
    await wireSharedCollectibles({
      rpcUrl,
      accountAddress: credentials.accountAddress,
      privateKey: credentials.privateKey,
      entryTokenAddress,
      lootChestAddress,
      dryRun,
    });
  } else {
    console.log("No entry token / loot chest configured — skipping collectible role wiring (dev free-entry flow).");
  }
  await bootstrapRegistrar({
    account,
    adminAddress: credentials.accountAddress,
    entryTokenAddress: entryTokenAddress ?? "0x0",
    lootChestAddress: lootChestAddress ?? "0x0",
    dryRun,
  });
  await registerAppchainPreset({ presetId: PRESET_ID, dryRun });
}

deployS2World().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
