import { EternumProvider } from "@bibliothecadao/eternum";
import { getGameManifest } from "@contracts";
import { Account } from "starknet";
import { confirmNonLocalDeployment } from "../../config/utils/confirmation";
import { logNetwork, type NetworkType } from "../../config/utils/environment";
import { type Chain } from "../../config/utils/utils";
import accounts from "./accounts.json";
import { GamePopulator, nodeReadConfig } from "./config";
const {
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_CHAIN,
  VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
} = process.env;

// =============== SETUP ETERNUM CONFIG ===============

// prompt user to confirm non-local deployment
confirmNonLocalDeployment(VITE_PUBLIC_CHAIN!);

const manifest = await getGameManifest(VITE_PUBLIC_CHAIN! as Chain);
const provider = new EternumProvider(manifest, VITE_PUBLIC_NODE_URL, VITE_PUBLIC_VRF_PROVIDER_ADDRESS);
const accountsConfig = []
for (let account of accounts) {
  accountsConfig.push(new Account(provider.provider, account.address, account.pk))
}
const configuration = await nodeReadConfig(VITE_PUBLIC_CHAIN! as Chain);
export const gamePopulator = new GamePopulator(configuration);

// Deploy configurations
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);
await gamePopulator.populate(accountsConfig, provider);
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);