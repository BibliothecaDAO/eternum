import devManifest from "../contracts/manifests/dev/deployment/manifest.json";
import productionManifest from "../contracts/manifests/prod/deployment/manifest.json";

import * as fs from "fs";
import { EternumProvider, ConfigManager, type EternumConfig } from "@bibliothecadao/eternum";

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

const provider = new EternumProvider(manifest, nodeUrl);
const account = new Account(provider.provider, VITE_PUBLIC_MASTER_ADDRESS, VITE_PUBLIC_MASTER_PRIVATE_KEY);

const configPath = "../config/EternumConfig.json";
let configData: Partial<EternumConfig> = {};
try {
  const rawData = fs.readFileSync(configPath, "utf-8");
  if (rawData.trim()) {
    configData = JSON.parse(rawData);
  }
} catch (error) {
  console.warn(`Failed to load config: ${error}`);
}

const configManager = ConfigManager.instance(configData);
await configManager.setConfigs(account, provider);
