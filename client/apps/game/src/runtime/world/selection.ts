import type { Chain } from "@contracts";
import { buildWorldProfile } from "./profile-builder";
import { resolveChain, setActiveWorldName, setSelectedChain } from "./store";
import type { WorldProfile } from "./types";

export interface WorldSelectionInput {
  name: string;
  chain?: Chain;
  worldAddress?: string;
}

interface ApplyWorldSelectionResult {
  profile: WorldProfile;
  currentChain: Chain;
  targetChain: Chain;
  chainChanged: boolean;
}

export const applyWorldSelection = async (
  selection: WorldSelectionInput,
  fallbackChain: Chain,
): Promise<ApplyWorldSelectionResult> => {
  const currentChain = resolveChain(fallbackChain);
  const targetChain = selection.chain ?? currentChain;
  const chainChanged = targetChain !== currentChain;

  if (chainChanged) {
    setSelectedChain(targetChain);
  }

  const profile = await buildWorldProfile(targetChain, selection.name);
  setActiveWorldName(selection.name);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("eternum:world-selection-changed", {
        detail: {
          name: selection.name,
          chain: targetChain,
          worldAddress: selection.worldAddress ?? profile.worldAddress,
        },
      }),
    );
  }

  return { profile, currentChain, targetChain, chainChanged };
};
