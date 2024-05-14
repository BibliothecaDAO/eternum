import devManifest from "../contracts/manifests/dev/manifest.json";
import productionManifest from "../contracts/manifests/prod/manifest.json";

import {
  EternumProvider,
  setProductionConfig,
  setPopulationConfig,
  setResourceBuildingConfig,
  setWeightConfig,
  setCombatConfig,
  setupGlobals,
  setCapacityConfig,
  setSpeedConfig,
  setQuestConfig,
} from "@bibliothecadao/eternum";
import { Account } from "starknet";
import { setBuildingConfig } from "@bibliothecadao/eternum";

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

await setProductionConfig(account, provider);
await setPopulationConfig(account, provider);
await setBuildingConfig(account, provider);
await setResourceBuildingConfig(account, provider);
await setWeightConfig(account, provider);
await setCombatConfig(account, provider);
await setCapacityConfig(account, provider);
await setSpeedConfig(account, provider);
await setQuestConfig(account, provider);
await setupGlobals(account, provider);
