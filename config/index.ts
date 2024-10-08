import devManifest from "../contracts/manifests/dev/deployment/manifest.json";
import productionManifest from "../contracts/manifests/prod/deployment/manifest.json";

import { EternumConfig, EternumProvider } from "@bibliothecadao/eternum";
import { Account } from "starknet";

if (
  !process.env.VITE_PUBLIC_MASTER_ADDRESS ||
  !process.env.VITE_PUBLIC_MASTER_PRIVATE_KEY ||
  !process.env.VITE_PUBLIC_NODE_URL
) {
  throw new Error("VITE_PUBLIC_MASTER_ADDRESS is required");
}

const VITE_PUBLIC_MASTER_ADDRESS = process.env.VITE_PUBLIC_MASTER_ADDRESS;
const VITE_PUBLIC_MASTER_PRIVATE_KEY = process.env.VITE_PUBLIC_MASTER_PRIVATE_KEY;

const manifest = process.env.VITE_PUBLIC_DEV === "true" ? devManifest : productionManifest;

// Bug in bun we have to use http://127.0.0.1:5050/
const nodeUrl = process.env.VITE_PUBLIC_DEV === "true" ? "http://127.0.0.1:5050/" : process.env.VITE_PUBLIC_NODE_URL;

const isDev = process.env.VITE_PUBLIC_DEV === "true";

if (!isDev) {
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

export const config = new EternumConfig();

await config.setup(account, provider);
