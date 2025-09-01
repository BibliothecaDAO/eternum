import { EternumProvider, ResourceWhitelistConfig } from "@bibliothecadao/eternum";
import { Account } from "starknet";
import { Chain, getGameManifest, getSeasonAddresses } from "../../../../utils/utils";

export const getResourceAddresses = () => {
  const addresses = getSeasonAddresses(process.env.VITE_PUBLIC_CHAIN as Chain).resources;
  return addresses;
};

const resourceAddresses = getResourceAddresses();

interface Config {
  account: Account;
  provider: EternumProvider;
}

export class EternumConfig {
  async setup(account: Account, provider: EternumProvider) {
    const config = { account, provider };
    await setResourceBridgeWhitelistConfig(config);
  }
}

export const setResourceBridgeWhitelistConfig = async (config: Config) => {
  let resourceWhitelistConfigs: ResourceWhitelistConfig[] = [];
  for (const [resourceName, [resourceId, tokenAddress]] of Object.entries(resourceAddresses)) {
    resourceWhitelistConfigs.push({
      token: tokenAddress,
      resource_type: resourceId,
    });
    console.log(`Configuring whitelist for ${resourceName} (${resourceId}) (${tokenAddress}) for in-game asset bridge`);
  }
  const tx = await config.provider.set_resource_bridge_whitlelist_config({
    signer: config.account,
    resource_whitelist_configs: resourceWhitelistConfigs,
  });

  console.log(`Finished configuring whitelist for in-game asset bridge ${tx.statusReceipt}`);

  // wait for 3 seconds
  await new Promise((resolve) => setTimeout(resolve, 3000));
};

//////////////////////////////////////////////////////////////

const { VITE_PUBLIC_MASTER_ADDRESS, VITE_PUBLIC_MASTER_PRIVATE_KEY, VITE_PUBLIC_NODE_URL } = process.env;
if (!VITE_PUBLIC_MASTER_ADDRESS || !VITE_PUBLIC_MASTER_PRIVATE_KEY || !VITE_PUBLIC_NODE_URL) {
  throw new Error("VITE_PUBLIC_MASTER_ADDRESS is required");
}
const manifest = getGameManifest(process.env.VITE_PUBLIC_CHAIN as Chain);

if (process.env.VITE_PUBLIC_CHAIN !== "local") {
  const userConfirmation = prompt(
    "You are about to set the configuration for a non-development environment. Are you sure you want to proceed? (yes/no)",
  );
  if (userConfirmation?.toLowerCase() !== "yes") {
    console.log("Configuration setup cancelled.");
    process.exit(0);
  }
}

console.log("Provider set up");
// Bug in bun we have to use http://127.0.0.1:5050/
const provider = new EternumProvider(manifest, VITE_PUBLIC_NODE_URL);

console.log("Account set up");
const account = new Account({provider: provider.provider, address: VITE_PUBLIC_MASTER_ADDRESS, signer: VITE_PUBLIC_MASTER_PRIVATE_KEY});

console.log("Setting up config...");
export const config = new EternumConfig();
await config.setup(account, provider);
