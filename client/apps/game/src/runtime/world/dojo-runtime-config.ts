import { setSqlApiBaseUrl } from "@/services/api";
import type { Chain } from "@contracts";
import { getGameManifest } from "@contracts";

import { dojoConfig } from "../../../dojo-config";
import { env } from "../../../env";
import { patchManifestWithFactory } from "./manifest-patcher";
import type { WorldProfile } from "./types";

type MutableDojoConfig = typeof dojoConfig & {
  toriiUrl?: string;
  rpcUrl?: string;
  manifest?: unknown;
};

export const configureSelectedWorldDojoRuntime = ({ chain, profile }: { chain: Chain; profile: WorldProfile }) => {
  const mutableDojoConfig = dojoConfig as MutableDojoConfig;
  const toriiUrl = resolveSelectedWorldToriiUrl({ chain, profile });

  mutableDojoConfig.toriiUrl = toriiUrl;
  mutableDojoConfig.rpcUrl = resolveSelectedWorldRpcUrl({ chain, profile });
  mutableDojoConfig.manifest = patchManifestWithFactory(
    getGameManifest(chain),
    profile.worldAddress,
    profile.contractsBySelector,
  );

  setSqlApiBaseUrl(`${toriiUrl}/sql`);
};

const resolveSelectedWorldToriiUrl = ({ chain, profile }: { chain: Chain; profile: WorldProfile }) => {
  return chain === "local" ? env.VITE_PUBLIC_TORII : profile.toriiBaseUrl;
};

const resolveSelectedWorldRpcUrl = ({ chain, profile }: { chain: Chain; profile: WorldProfile }) => {
  if (chain === "local") {
    return env.VITE_PUBLIC_NODE_URL;
  }

  return profile.rpcUrl ?? env.VITE_PUBLIC_NODE_URL;
};
