import { getGameManifest } from "@contracts";
import type { GameChain as Chain } from "@realms-world/chain";
import { resolveEndpoint } from "@realms-world/chain";

import { namespaceForChain, type GameNamespace } from "@/dojo/game-scope";
import { env } from "../../../env";
import { normalizeSelector } from "./normalize";

/**
 * The world directory — the client's single source of "what worlds exist".
 *
 * A world is one deployed world contract plus its Torii indexer; games (Blitz)
 * and seasons (Eternum) are GameRegistry rows inside a world. Madara exposes
 * the phase-one Blitz world, while appchain may expose both world manifests.
 *
 * Both phase-one chains use committed manifests and GameRegistry rows.
 */
export interface WorldDeployment {
  /** Stable world key — "blitz" now, "eternum" from W5. */
  id: string;
  chain: Chain;
  rpcUrl: string;
  toriiBaseUrl: string;
  namespace: GameNamespace;
  worldAddress: string;
  /** Normalized selector -> address from the world's committed manifest. */
  contractsBySelector: Record<string, string>;
  playerAccountClassHash: string;
  playerRegistryAddress: string;
  bindingAuthorityAddress: string;
}

interface CommittedManifest {
  world: { address: string };
  contracts: { selector: string; address: string }[];
}

const buildWorld = (chain: Chain, id: "blitz" | "eternum", toriiBaseUrl: string): WorldDeployment => {
  const manifest = getGameManifest(chain, id) as unknown as CommittedManifest;
  return {
    id,
    chain,
    rpcUrl: resolveEndpoint(env.VITE_PUBLIC_NODE_URL, { name: "VITE_PUBLIC_NODE_URL", browserFacing: true }),
    toriiBaseUrl: resolveEndpoint(toriiBaseUrl, { name: "VITE_PUBLIC_TORII", browserFacing: true }),
    namespace: namespaceForChain(chain),
    worldAddress: manifest.world.address,
    contractsBySelector: Object.fromEntries(
      manifest.contracts.map((contract) => [normalizeSelector(contract.selector), contract.address]),
    ),
    playerAccountClassHash: env.VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH,
    playerRegistryAddress: env.VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS,
    bindingAuthorityAddress: env.VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS,
  };
};

let directory: WorldDeployment[] | null = null;

export const getWorldDirectory = (): WorldDeployment[] => {
  if (!directory) {
    directory = [buildWorld(env.VITE_PUBLIC_CHAIN, "blitz", env.VITE_PUBLIC_TORII)];
    if (env.VITE_PUBLIC_CHAIN === "appchain" && env.VITE_PUBLIC_TORII_ETERNUM) {
      directory.push(buildWorld("appchain", "eternum", env.VITE_PUBLIC_TORII_ETERNUM));
    }
  }
  return directory;
};

export const getWorldById = (worldId: string | null | undefined): WorldDeployment | null =>
  worldId ? (getWorldDirectory().find((world) => world.id === worldId) ?? null) : null;

export const getDefaultWorld = (): WorldDeployment => getWorldDirectory()[0];
