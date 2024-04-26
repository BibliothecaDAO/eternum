import manifest from "../contracts/manifests/dev/manifest.json";
import productionManifest from "../contracts/manifests/prod/manifest.json";
import { createDojoConfig } from "@dojoengine/core";

const {
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_TORII,
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_ACCOUNT_CLASS_HASH,
  VITE_PUBLIC_DEV,
  VITE_PUBLIC_FEE_TOKEN_ADDRESS,
} = import.meta.env;

export const dojoConfig = createDojoConfig({
  rpcUrl: VITE_PUBLIC_NODE_URL,
  toriiUrl: VITE_PUBLIC_TORII,
  masterAddress: VITE_PUBLIC_MASTER_ADDRESS,
  masterPrivateKey: VITE_PUBLIC_MASTER_PRIVATE_KEY,
  accountClassHash:
    VITE_PUBLIC_ACCOUNT_CLASS_HASH || "0x05400e90f7e0ae78bd02c77cd75527280470e2fe19c54970dd79dc37a9d3645c",
  feeTokenAddress: VITE_PUBLIC_FEE_TOKEN_ADDRESS || "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  manifest: VITE_PUBLIC_DEV ? manifest : productionManifest,
});
