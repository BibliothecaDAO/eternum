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

console.log("Setting up config...");
const provider = new EternumProvider(manifest, nodeUrl);
console.log("Provider set up");
const account = new Account(provider.provider, VITE_PUBLIC_MASTER_ADDRESS, VITE_PUBLIC_MASTER_PRIVATE_KEY);
console.log("Account set up");

const setupConfig = process.env.VITE_PUBLIC_DEV
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

export const config = new EternumConfig(setupConfig);

await config.setup(account, provider);

console.log("Waiting 30 seconds before proceeding...");
await new Promise((resolve) => setTimeout(resolve, 30000));
console.log("30 seconds have passed. Continuing...");

// If liquidity doesn't work, run the above, then run this...
await config.setupBank(account, provider);
