import { TORII_SETTING } from "@/utils/config";
import {
  buildSharedSlotRpcUrl,
  getActiveWorld,
  isSlotWorldChain,
  listSavedWorldProfiles,
  normalizeRpcUrl,
  patchManifestWithFactory,
  probeSlotDeploymentRpcAlive,
  probeWorldToriiAlive,
  purgeDeadSlotWorldProfiles,
  purgeUnavailableSlotWorldProfiles,
  resolveChain,
  type WorldProfile,
} from "@/runtime/world";
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

const cartridgeApiBase = env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg";

// Both purges must run BEFORE `getActiveWorld()` below. dojo-config is module-
// loaded before React mounts, so it's the only choke point that runs ahead of
// `StarknetProvider` building a `ControllerConnector` against a saved RPC URL.
// Cold-reloading on a Cartridge-GC'd slot deployment would otherwise bake the
// dead RPC into the connector, `starknet_chainId` 404s, and the user is stuck
// on "Reconnect to Continue" forever.
purgeUnavailableSlotWorldProfiles();

const isSavedSlotWorldProfile = (profile: WorldProfile): boolean =>
  profile.chain === "slot" || profile.chain === "slottest";

const probeSavedSlotWorldProfile = async (profile: WorldProfile): Promise<string | null> => {
  const [rpcAlive, toriiAlive] = await Promise.all([
    probeSlotDeploymentRpcAlive(profile.rpcUrl),
    probeWorldToriiAlive(profile.toriiBaseUrl),
  ]);

  return rpcAlive === false || toriiAlive === false ? profile.name : null;
};

const resolveDeadSlotWorldNames = async (): Promise<Set<string>> => {
  const slotProfilesToProbe = listSavedWorldProfiles().filter(isSavedSlotWorldProfile);
  const probeResults = await Promise.all(slotProfilesToProbe.map(probeSavedSlotWorldProfile));

  return new Set(probeResults.filter((name): name is string => name !== null));
};

// Probe each saved slot profile before `ControllerConnector` is created.
// The RPC probe protects controller init, while the Torii probe catches old
// per-world indexers that can 404 even when the shared slot RPC is still alive.
// `null` from either probe is indeterminate, so profiles are only evicted on
// explicit dead signals.
const probedDeadSlotNames = await resolveDeadSlotWorldNames();
const evictedDeadSlotWorlds = purgeDeadSlotWorldProfiles(probedDeadSlotNames);
if (evictedDeadSlotWorlds.length > 0) {
  console.warn(
    `[dojo-config] Evicted dead slot world profiles: ${evictedDeadSlotWorlds.join(", ")}. Falling back to env defaults.`,
  );
}

// If a previously saved world profile exists, patch manifest and prefer its Torii.
const activeWorld = getActiveWorld();
const resolvedChain = activeWorld?.chain ?? resolveChain(VITE_PUBLIC_CHAIN! as Chain);
let manifest = getGameManifest(resolvedChain as Chain);
const toriiFromWorld = activeWorld?.toriiBaseUrl;
const rpcFromWorld = activeWorld?.rpcUrl;
if (activeWorld && activeWorld.contractsBySelector && activeWorld.worldAddress) {
  manifest = patchManifestWithFactory(manifest as any, activeWorld.worldAddress, activeWorld.contractsBySelector);
}

const resolveDojoConfigRpcUrl = (chain: Chain, profileRpcUrl: string | undefined): string => {
  if (isSlotWorldChain(chain)) {
    return buildSharedSlotRpcUrl(cartridgeApiBase);
  }

  return normalizeRpcUrl(profileRpcUrl ?? VITE_PUBLIC_NODE_URL);
};

export const dojoConfig = createDojoConfig({
  rpcUrl: resolveDojoConfigRpcUrl(resolvedChain, rpcFromWorld),
  toriiUrl: toriiFromWorld ?? (await TORII_SETTING()),
  masterAddress: VITE_PUBLIC_MASTER_ADDRESS,
  masterPrivateKey: VITE_PUBLIC_MASTER_PRIVATE_KEY,
  accountClassHash:
    VITE_PUBLIC_ACCOUNT_CLASS_HASH || "0x07dc7899aa655b0aae51eadff6d801a58e97dd99cf4666ee59e704249e51adf2",
  feeTokenAddress: VITE_PUBLIC_FEE_TOKEN_ADDRESS || "0x0",
  manifest,
});
