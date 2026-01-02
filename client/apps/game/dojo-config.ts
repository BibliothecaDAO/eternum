import { TORII_SETTING } from "@/utils/config";
import { getActiveWorld, patchManifestWithFactory, normalizeRpcUrl } from "@/runtime/world";
import { Chain, getGameManifest } from "@contracts";
import { createDojoConfig } from "@dojoengine/core";
import { env } from "./env";

const {
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_ACCOUNT_CLASS_HASH,
  VITE_PUBLIC_FEE_TOKEN_ADDRESS,
  VITE_PUBLIC_CHAIN,
} = env;

let manifest = getGameManifest(VITE_PUBLIC_CHAIN! as Chain);

// If a previously saved world profile exists, patch manifest and prefer its Torii.
const activeWorld = getActiveWorld();
const toriiFromWorld = activeWorld?.toriiBaseUrl;
const rpcFromWorld = activeWorld?.rpcUrl;
if (activeWorld && activeWorld.contractsBySelector && activeWorld.worldAddress) {
  manifest = patchManifestWithFactory(manifest as any, activeWorld.worldAddress, activeWorld.contractsBySelector);
}

export const dojoConfig = createDojoConfig({
  rpcUrl: normalizeRpcUrl(rpcFromWorld ?? VITE_PUBLIC_NODE_URL),
  toriiUrl: toriiFromWorld ?? (await TORII_SETTING()),
  masterAddress: VITE_PUBLIC_MASTER_ADDRESS,
  masterPrivateKey: VITE_PUBLIC_MASTER_PRIVATE_KEY,
  accountClassHash:
    VITE_PUBLIC_ACCOUNT_CLASS_HASH || "0x07dc7899aa655b0aae51eadff6d801a58e97dd99cf4666ee59e704249e51adf2",
  feeTokenAddress: VITE_PUBLIC_FEE_TOKEN_ADDRESS || "0x0",
  manifest,
});
