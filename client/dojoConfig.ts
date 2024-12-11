import { createDojoConfig } from "@dojoengine/core";
import devManifest from "../contracts/manifest_dev.json";
import mainnetManifest from "../contracts/manifest_mainnet.json";
import productionManifest from "../contracts/manifest_prod.json";

import { env } from "./env";
const {
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_TORII,
  VITE_PUBLIC_TORII_RELAY,
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_ACCOUNT_CLASS_HASH,
  VITE_PUBLIC_DEV,
  VITE_PUBLIC_FEE_TOKEN_ADDRESS,
  VITE_PUBLIC_CHAIN,
} = env;

let manifest = VITE_PUBLIC_DEV === true ? devManifest : productionManifest;

manifest = VITE_PUBLIC_CHAIN === "mainnet" ? mainnetManifest : manifest;

export const dojoConfig = createDojoConfig({
  rpcUrl: VITE_PUBLIC_NODE_URL,
  toriiUrl: VITE_PUBLIC_TORII,
  relayUrl: VITE_PUBLIC_TORII_RELAY,
  masterAddress: VITE_PUBLIC_MASTER_ADDRESS,
  masterPrivateKey: VITE_PUBLIC_MASTER_PRIVATE_KEY,
  accountClassHash:
    VITE_PUBLIC_ACCOUNT_CLASS_HASH || "0x07dc7899aa655b0aae51eadff6d801a58e97dd99cf4666ee59e704249e51adf2",
  feeTokenAddress: VITE_PUBLIC_FEE_TOKEN_ADDRESS || "0x0",
  manifest,
});
