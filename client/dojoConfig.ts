import { createDojoConfig } from "@dojoengine/core";
import devManifest from "../contracts/manifests/dev/deployment/manifest.json";
import productionManifest from "../contracts/manifests/prod/deployment/manifest.json";

const {
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_TORII,
  VITE_PUBLIC_TORII_RELAY,
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_ACCOUNT_CLASS_HASH,
  VITE_PUBLIC_DEV,
  VITE_PUBLIC_FEE_TOKEN_ADDRESS,
} = import.meta.env;

const manifest = VITE_PUBLIC_DEV === "true" ? devManifest : productionManifest;

export const dojoConfig = createDojoConfig({
  rpcUrl: VITE_PUBLIC_NODE_URL,
  toriiUrl: VITE_PUBLIC_TORII,
  relayUrl: VITE_PUBLIC_TORII_RELAY,
  masterAddress: VITE_PUBLIC_MASTER_ADDRESS,
  masterPrivateKey: VITE_PUBLIC_MASTER_PRIVATE_KEY,
  accountClassHash:
    VITE_PUBLIC_ACCOUNT_CLASS_HASH || "0x07dc7899aa655b0aae51eadff6d801a58e97dd99cf4666ee59e704249e51adf2",
  feeTokenAddress: VITE_PUBLIC_FEE_TOKEN_ADDRESS || "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  manifest,
});
