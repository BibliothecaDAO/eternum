import { getGameManifest, type Chain } from "@contracts";

import { namespaceForChain, type GameNamespace } from "@/dojo/game-scope";
import { env } from "../../../env";
import { normalizeSelector } from "./normalize";

/**
 * The world directory — the client's single source of "what worlds exist".
 *
 * A world is one deployed world contract plus its torii; games (blitz) and
 * seasons (eternum) are GameRegistry rows INSIDE a world. The MVP runs the
 * blitz world alone; the eternum world becomes a second entry in W5. Both
 * share one katana and one namespace by design — splitting a world onto its
 * own chain later only changes its entry here, never code.
 *
 * Appchain-only (amendment S1): legacy mainnet worlds never appear here.
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
}

interface CommittedManifest {
  world: { address: string };
  contracts: { selector: string; address: string }[];
}

const buildBlitzWorld = (): WorldDeployment => {
  const manifest = getGameManifest("appchain", "blitz") as unknown as CommittedManifest;
  return {
    id: "blitz",
    chain: "appchain",
    rpcUrl: env.VITE_PUBLIC_NODE_URL,
    toriiBaseUrl: env.VITE_PUBLIC_TORII.replace(/\/+$/, ""),
    namespace: namespaceForChain("appchain"),
    worldAddress: manifest.world.address,
    contractsBySelector: Object.fromEntries(
      manifest.contracts.map((contract) => [normalizeSelector(contract.selector), contract.address]),
    ),
  };
};

let directory: WorldDeployment[] | null = null;

export const getWorldDirectory = (): WorldDeployment[] => {
  directory ??= [buildBlitzWorld()];
  return directory;
};

export const getWorldById = (worldId: string | null | undefined): WorldDeployment | null =>
  worldId ? (getWorldDirectory().find((world) => world.id === worldId) ?? null) : null;

export const getDefaultWorld = (): WorldDeployment => getWorldDirectory()[0];
