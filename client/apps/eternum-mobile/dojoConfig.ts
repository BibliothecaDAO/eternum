import { createDojoConfig } from "@dojoengine/core";
import { Chain, getGameManifest } from "../../../contracts/utils/utils";
import { env } from "./env";
import { ETERNUM_CONFIG } from "./src/app/config/config";

const {
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_TORII,
  //VITE_PUBLIC_TORII_RELAY,
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_ACCOUNT_CLASS_HASH,
  VITE_PUBLIC_FEE_TOKEN_ADDRESS,
  VITE_PUBLIC_CHAIN,
} = env;

const manifest = getGameManifest(VITE_PUBLIC_CHAIN! as Chain);

export const dojoConfig = createDojoConfig({
  rpcUrl: VITE_PUBLIC_NODE_URL,
  toriiUrl: VITE_PUBLIC_TORII,
  // relayUrl: VITE_PUBLIC_TORII_RELAY,
  masterAddress: VITE_PUBLIC_MASTER_ADDRESS,
  masterPrivateKey: VITE_PUBLIC_MASTER_PRIVATE_KEY,
  accountClassHash:
    VITE_PUBLIC_ACCOUNT_CLASS_HASH || "0x07dc7899aa655b0aae51eadff6d801a58e97dd99cf4666ee59e704249e51adf2",
  feeTokenAddress: VITE_PUBLIC_FEE_TOKEN_ADDRESS || "0x0",
  manifest,
});

const config = ETERNUM_CONFIG();
console.log("logging eternum configuration json from file");
console.log({ config });
