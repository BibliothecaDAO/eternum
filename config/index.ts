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
import { dojoConfig } from "../client/dojoConfig";
import { Account, Provider } from "starknet";
import { setBuildingConfig } from "@bibliothecadao/eternum";

const VITE_PUBLIC_MASTER_ADDRESS = "0xb3ff441a68610b30fd5e2abbf3a1548eb6ba6f3559f2862bf2dc757e5828ca";
const VITE_PUBLIC_MASTER_PRIVATE_KEY = "0x2bbf4f9fd0bbb2e60b0316c1fe0b76cf7a4d0198bd493ced9b8df2a3a24d68a";

const provider = new EternumProvider(devManifest, "http://127.0.0.1:5050");

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
