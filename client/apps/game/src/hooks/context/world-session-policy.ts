import { buildWorldProfile } from "@/runtime/world/profile-builder";
import { getActiveWorld } from "@/runtime/world/store";
import type { WorldProfile } from "@/runtime/world/types";
import type { Chain } from "@contracts";
import { buildWorldPolicies } from "./policies";
import { refreshSessionPoliciesWithPolicies } from "./session-policy-refresh";
import { env } from "../../../env";

export const buildWorldPolicyScope = (chain: Chain, worldName: string) => `world:${chain}:${worldName}`;

export const resolveWorldPolicyProfile = async (chain: Chain, worldName: string): Promise<WorldProfile> => {
  const activeWorld = getActiveWorld();
  if (activeWorld?.name === worldName && activeWorld?.chain === chain) {
    return activeWorld;
  }

  return buildWorldProfile(chain, worldName);
};

type EnsureWorldSessionPoliciesParams = {
  connector: unknown | null | undefined;
  chain: Chain;
  worldName: string;
  profile?: WorldProfile;
};

export const ensureWorldSessionPolicies = async ({
  connector,
  chain,
  worldName,
  profile,
}: EnsureWorldSessionPoliciesParams): Promise<boolean> => {
  if (!connector) {
    return false;
  }

  const worldProfile = profile ?? (await resolveWorldPolicyProfile(chain, worldName));
  const effectiveChain = worldProfile.chain ?? chain;
  const effectiveWorldName = worldProfile.name ?? worldName;
  const fullWorldPolicies = buildWorldPolicies({
    chain: effectiveChain,
    contractsBySelector: worldProfile.contractsBySelector,
    worldAddress: worldProfile.worldAddress,
    feeTokenAddress: worldProfile.feeTokenAddress,
    entryTokenAddress: worldProfile.entryTokenAddress,
    vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
  });

  return refreshSessionPoliciesWithPolicies(
    connector,
    fullWorldPolicies,
    buildWorldPolicyScope(effectiveChain, effectiveWorldName),
  );
};
