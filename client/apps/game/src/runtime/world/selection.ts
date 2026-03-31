import type { Chain } from "@contracts";
import { markGameEntryMilestone, recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
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
  const selectionStartedAt = performance.now();
  const currentChain = resolveChain(fallbackChain);
  const targetChain = selection.chain ?? currentChain;
  const chainChanged = targetChain !== currentChain;

  // Always persist the selected chain so later bootstrap reads the same network,
  // even when current and target chains are already equal.
  const profileBuildStartedAt = performance.now();
  markGameEntryMilestone("world-profile-build-started");
  const profile = await buildWorldProfile(targetChain, selection.name);
  markGameEntryMilestone("world-profile-build-completed");
  recordGameEntryDuration("world-profile-build", performance.now() - profileBuildStartedAt);

  const statePersistStartedAt = performance.now();
  setSelectedChain(targetChain);
  setActiveWorldName(selection.name);
  markGameEntryMilestone("world-selection-state-persisted");
  recordGameEntryDuration("world-selection-state-persist", performance.now() - statePersistStartedAt);
  recordGameEntryDuration("world-selection-total", performance.now() - selectionStartedAt);

  return { profile, currentChain, targetChain, chainChanged };
};
