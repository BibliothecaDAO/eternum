import { EternumProvider } from "@bibliothecadao/provider";
import { getGameManifest } from "@contracts";
import { Account } from "starknet";
import { confirmNonLocalDeployment } from "../utils/confirmation";
import { logNetwork, saveConfigJsonFromConfigTsFile, type NetworkType } from "../utils/environment";
import { type Chain } from "../utils/utils";
import { GameConfigDeployer, nodeReadConfig } from "./config";

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
await saveConfigJsonFromConfigTsFile(VITE_PUBLIC_CHAIN! as NetworkType);
const configuration = await nodeReadConfig(VITE_PUBLIC_CHAIN! as Chain);
export const config = new GameConfigDeployer(configuration, VITE_PUBLIC_CHAIN! as NetworkType);

// Deploy configurations
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);
await config.setupAll(account, provider);
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);
