import { manifestLocal, manifestMainnet, manifestSepolia, } from "@bibliothecadao/assets";
import { EternumProvider, ResourceWhitelistConfig } from "@bibliothecadao/eternum";
import { readFileSync } from "fs";
import { join } from "path";
import { Account } from "starknet";

const getResourceAddresses = () => {
  const network = process.env.STARKNET_NETWORK;
  const filePath = join(__dirname, `../addresses/${network}/resource_addresses.json`);
  return JSON.parse(readFileSync(filePath, "utf-8"));
};

const resourceAddresses = getResourceAddresses();

interface Config {
  account: Account;
  provider: EternumProvider;
}

export class EternumConfig {
  async setup(account: Account, provider: EternumProvider) {
    const config = { account, provider };
    await setResourceBridgeWhitlelistConfig(config);
  }
}

export const setResourceBridgeWhitlelistConfig = async (config: Config) => {
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

const { VITE_PUBLIC_MASTER_ADDRESS, VITE_PUBLIC_MASTER_PRIVATE_KEY, VITE_PUBLIC_NODE_URL } =
  process.env;
if (!VITE_PUBLIC_MASTER_ADDRESS || !VITE_PUBLIC_MASTER_PRIVATE_KEY || !VITE_PUBLIC_NODE_URL) {
  throw new Error("VITE_PUBLIC_MASTER_ADDRESS is required");
}
const manifest = process.env.VITE_PUBLIC_CHAIN === "mainnet" 
  ? manifestMainnet 
  : process.env.VITE_PUBLIC_CHAIN === "sepolia" 
    ? manifestSepolia 
    : process.env.VITE_PUBLIC_CHAIN === "local"
      ? manifestLocal
      : manifestLocal;

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
const account = new Account(provider.provider, VITE_PUBLIC_MASTER_ADDRESS, VITE_PUBLIC_MASTER_PRIVATE_KEY);

console.log("Setting up config...");
export const config = new EternumConfig();
await config.setup(account, provider);
