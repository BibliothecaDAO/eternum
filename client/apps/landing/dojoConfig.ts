import { manifestLocal, manifestMainnet, manifestSepolia } from "@bibliothecadao/assets";
import { createDojoConfig } from "@dojoengine/core";
import { env } from "./env";

const {
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_TORII,
  VITE_PUBLIC_TORII_RELAY,
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_ACCOUNT_CLASS_HASH,
  VITE_PUBLIC_FEE_TOKEN_ADDRESS,
  VITE_PUBLIC_CHAIN,
} = env;

// const isLocal = VITE_PUBLIC_CHAIN === "local" || VITE_PUBLIC_CHAIN === "testnet";
// const manifest = VITE_PUBLIC_DEV === true && isLocal ? manifestLocal : manifestMainnet;

const manifestMap = {
  local: manifestLocal,
  mainnet: manifestMainnet,
  sepolia: manifestSepolia,
} as const;

const manifest = manifestMap[VITE_PUBLIC_CHAIN as keyof typeof manifestMap] ?? manifestSepolia;

export const getManifest = () => {
  return manifest;
};

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
