import { getActiveWorld, normalizeRpcUrl, patchManifestWithFactory, resolveChain } from "@/runtime/world";
import { getGameManifest } from "@contracts";
import type { GameChain as Chain } from "@realms-world/chain";
import { createDojoConfig } from "@dojoengine/core";
import { env } from "./env";

const { VITE_PUBLIC_NODE_URL, VITE_PUBLIC_ACCOUNT_CLASS_HASH, VITE_PUBLIC_FEE_TOKEN_ADDRESS, VITE_PUBLIC_CHAIN } = env;

// If a previously saved world profile exists, patch manifest and prefer its Torii.
const activeWorld = getActiveWorld();
const resolvedChain = activeWorld?.chain ?? resolveChain(VITE_PUBLIC_CHAIN! as Chain);
let manifest = getGameManifest(resolvedChain as Chain);
const toriiFromWorld = activeWorld?.toriiBaseUrl;
const rpcFromWorld = activeWorld?.rpcUrl;
if (activeWorld && activeWorld.contractsBySelector && activeWorld.worldAddress) {
  manifest = patchManifestWithFactory(manifest as any, activeWorld.worldAddress, activeWorld.contractsBySelector);
}

const resolveDojoConfigRpcUrl = (profileRpcUrl: string | undefined): string =>
  normalizeRpcUrl(profileRpcUrl ?? VITE_PUBLIC_NODE_URL);

export const dojoConfig = createDojoConfig({
  rpcUrl: resolveDojoConfigRpcUrl(rpcFromWorld),
  toriiUrl: toriiFromWorld ?? env.VITE_PUBLIC_TORII,
  accountClassHash: VITE_PUBLIC_ACCOUNT_CLASS_HASH,
  feeTokenAddress: VITE_PUBLIC_FEE_TOKEN_ADDRESS,
  manifest,
});
