import type { Config } from "@bibliothecadao/eternum";
import devManifest from "../contracts/manifest_dev.json";
import productionManifest from "../contracts/manifest_mainnet.json";

import {
  EternumConfig,
  EternumGlobalConfig,
  EternumProvider,
  getContractByName,
  NAMESPACE,
} from "@bibliothecadao/eternum";
import { Account } from "starknet";

if (
  !process.env.VITE_PUBLIC_MASTER_ADDRESS ||
  !process.env.VITE_PUBLIC_MASTER_PRIVATE_KEY ||
  !process.env.VITE_PUBLIC_NODE_URL
) {
  throw new Error("VITE_PUBLIC_MASTER_ADDRESS is required");
}

const {
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_DEV,
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_CHAIN,
  VITE_VRF_PROVIDER_ADDRESS,
} = process.env;

const manifest = VITE_PUBLIC_DEV === "true" ? devManifest : productionManifest;

// Bug in bun we have to use http://127.0.0.1:5050/
const nodeUrl = VITE_PUBLIC_DEV === "true" ? "http://127.0.0.1:5050/" : VITE_PUBLIC_NODE_URL;

if (!VITE_PUBLIC_DEV) {
  const userConfirmation = prompt(
    "You are about to set the configuration for a non-development environment. Are you sure you want to proceed? (yes/no)",
  );
  if (userConfirmation?.toLowerCase() !== "yes") {
    console.log("Configuration setup cancelled.");
    process.exit(0);
  }
}

console.log("Provider set up");
const provider = new EternumProvider(manifest, nodeUrl, VITE_VRF_PROVIDER_ADDRESS);

console.log("Account set up");
const account = new Account(provider.provider, VITE_PUBLIC_MASTER_ADDRESS, VITE_PUBLIC_MASTER_PRIVATE_KEY);

const setupConfig: Config = EternumGlobalConfig;

// const setupConfig: Config = EternumGlobalConfig;

setupConfig.vrf.vrfProviderAddress = VITE_VRF_PROVIDER_ADDRESS!;

// Bridge
(setupConfig.bridge = {
  ...EternumGlobalConfig.bridge,
  velords_fee_recipient: BigInt("0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5"), // burner
  season_pool_fee_recipient: BigInt(getContractByName(manifest, `${NAMESPACE}-season_systems`)),
}),
  // Season Pass
  (setupConfig.season = {
    ...EternumGlobalConfig.season,
    startAfterSeconds: 60 * 60, // 60 minutes
    // bridgeCloseAfterEndSeconds: 60 * 60 * 1, // 2 hours
    seasonPassAddress: process.env.VITE_SEASON_PASS_ADDRESS!,
    realmsAddress: process.env.VITE_REALMS_ADDRESS!,
    lordsAddress: process.env.VITE_LORDS_ADDRESS!,
  });

console.log(setupConfig.season);

export const config = new EternumConfig(setupConfig);

console.log("Setting up config...");
await config.setup(account, provider);

// Add a 20-second delay before setting up the bank
console.log("Waiting for 20 seconds before setting up the bank...");
await new Promise((resolve) => setTimeout(resolve, 20000));

console.log("Setting up bank...");
await config.setupBank(account, provider);
