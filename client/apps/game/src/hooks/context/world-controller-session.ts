import { applyWorldSelection } from "@/runtime/world";
import { configureSelectedWorldDojoRuntime } from "@/runtime/world/dojo-runtime-config";
import type { Chain } from "@contracts";

import { refreshSessionPolicies } from "./session-policy-refresh";

export const prepareControllerSessionForWorld = async ({
  connector,
  chain,
  worldName,
}: {
  connector: unknown;
  chain: Chain;
  worldName: string;
}) => {
  if (!connector) {
    throw new Error("Controller connector unavailable for world session preparation.");
  }

  const { profile } = await applyWorldSelection({ name: worldName, chain }, chain);

  configureSelectedWorldDojoRuntime({ chain, profile });
  await refreshSessionPolicies(connector);

  return profile;
};
