import { getActiveWorld, patchManifestWithFactory } from "@/runtime/world";
import { getGameManifest, type Chain } from "@contracts";
import { env } from "../../../../../../env";

interface PaymasterAction {
  contractAddress: string;
  entrypoint: string;
}

interface WorldManifest {
  address?: string;
  entrypoints?: string[];
}

interface ContractManifest {
  address?: string;
  systems?: string[];
}

interface GameManifestLike {
  world?: WorldManifest;
  contracts?: ContractManifest[];
}

export const buildPaymasterActions = (): PaymasterAction[] => {
  const chain = env.VITE_PUBLIC_CHAIN as Chain;
  const baseManifest = getGameManifest(chain) as unknown as GameManifestLike;
  const activeWorld = getActiveWorld();

  let manifest: GameManifestLike = baseManifest;

  if (activeWorld && activeWorld.contractsBySelector && activeWorld.worldAddress) {
    manifest = patchManifestWithFactory(
      baseManifest,
      activeWorld.worldAddress,
      activeWorld.contractsBySelector,
    ) as unknown as GameManifestLike;
  }

  const actionsMap = new Map<string, PaymasterAction>();

  const addAction = (contractAddress?: string, entrypoint?: string) => {
    if (!contractAddress || !entrypoint) return;
    const key = `${contractAddress.toLowerCase()}:${entrypoint}`;
    if (!actionsMap.has(key)) {
      actionsMap.set(key, { contractAddress, entrypoint });
    }
  };

  if (manifest?.world?.address && Array.isArray(manifest.world.entrypoints)) {
    const worldAddress = manifest.world.address as string;
    for (const entrypoint of manifest.world.entrypoints as string[]) {
      addAction(worldAddress, entrypoint);
    }
  }

  if (Array.isArray(manifest?.contracts)) {
    for (const contract of manifest.contracts) {
      const address = contract?.address;
      if (!address) continue;
      if (Array.isArray(contract.systems)) {
        for (const entrypoint of contract.systems) {
          addAction(address, entrypoint);
        }
      }
    }
  }

  if (env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS && env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS !== "0x0") {
    addAction(env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS, "request_random");
  }

  return Array.from(actionsMap.values());
};

export const downloadPaymasterActionsJson = () => {
  const actions = buildPaymasterActions();
  const activeWorld = getActiveWorld();
  const parts = ["eternum-actions", env.VITE_PUBLIC_CHAIN];
  if (activeWorld?.name) {
    parts.push(activeWorld.name);
  }
  const filename = `${parts.filter(Boolean).join("-")}.json`;

  const blob = new Blob([JSON.stringify(actions, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};
