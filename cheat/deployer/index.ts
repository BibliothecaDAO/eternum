import { EternumProvider } from "@bibliothecadao/eternum";
import { getGameManifest } from "@contracts";
import { Account } from "starknet";
import { confirmNonLocalDeployment } from "../../config/utils/confirmation";
import { logNetwork, type NetworkType } from "../../config/utils/environment";
import { type Chain } from "../../config/utils/utils";
import { GamePopulator, nodeReadConfig } from "./config";

const {
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_CHAIN,
  VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
} = process.env;

// =============== SETUP ETERNUM CONFIG ===============

// prompt user to confirm non-local deployment
confirmNonLocalDeployment(VITE_PUBLIC_CHAIN!);

const manifest = await getGameManifest(VITE_PUBLIC_CHAIN! as Chain);
const provider = new EternumProvider(manifest, VITE_PUBLIC_NODE_URL, VITE_PUBLIC_VRF_PROVIDER_ADDRESS);
const account = new Account(provider.provider, VITE_PUBLIC_MASTER_ADDRESS!, VITE_PUBLIC_MASTER_PRIVATE_KEY!);
const configuration = await nodeReadConfig(VITE_PUBLIC_CHAIN! as Chain);
export const gamePopulator = new GamePopulator(configuration);

// Deploy configurations
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);
await gamePopulator.populate(account, provider);
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);
