import type { Config } from "@bibliothecadao/eternum";
import devManifest from "../contracts/manifests/dev/deployment/manifest.json";
import productionManifest from "../contracts/manifests/prod/deployment/manifest.json";

import { EternumConfig, EternumGlobalConfig, EternumProvider } from "@bibliothecadao/eternum";
import { Account } from "starknet";

if (
  !process.env.VITE_PUBLIC_MASTER_ADDRESS ||
  !process.env.VITE_PUBLIC_MASTER_PRIVATE_KEY ||
  !process.env.VITE_PUBLIC_NODE_URL
) {
  throw new Error("VITE_PUBLIC_MASTER_ADDRESS is required");
}

const { VITE_PUBLIC_MASTER_ADDRESS, VITE_PUBLIC_MASTER_PRIVATE_KEY, VITE_PUBLIC_DEV, VITE_PUBLIC_NODE_URL } =
  process.env;

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
const provider = new EternumProvider(manifest, nodeUrl);

console.log("Account set up");
const account = new Account(provider.provider, VITE_PUBLIC_MASTER_ADDRESS, VITE_PUBLIC_MASTER_PRIVATE_KEY);

const setupConfig: Config =
  VITE_PUBLIC_DEV === "true"
    ? {
        ...EternumGlobalConfig,
        stamina: {
          travelCost: 0,
          exploreCost: 0,
        },
        battle: {
          graceTickCount: 0,
          delaySeconds: 0,
        },
      }
    : EternumGlobalConfig;

// probably should be refactored
setupConfig.season = {
  seasonPassAddress: process.env.VITE_SEASON_PASS_ADDRESS!,
  realmsAddress: process.env.VITE_REALMS_ADDRESS!,
};

export const config = new EternumConfig(setupConfig);

console.log("Setting up config...");
await config.setup(account, provider);

// Add a 20-second delay before setting up the bank
console.log("Waiting for 15 seconds before setting up the bank...");
await new Promise((resolve) => setTimeout(resolve, 20000));

console.log("Setting up bank...");

await config.setupBank(account, provider);
