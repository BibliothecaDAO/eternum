interface CatchUpCommittedWorldmapChunkManagersInput {
  runImmediateFullManagerCatchUp: () => Promise<void>;
  runImmediateStructureCatchUp: () => Promise<void>;
  scheduleDeferredRemainingManagerCatchUp: () => void;
  stagedPathEnabled: boolean;
}

export async function catchUpCommittedWorldmapChunkManagers(
  input: CatchUpCommittedWorldmapChunkManagersInput,
): Promise<void> {
  if (!input.stagedPathEnabled) {
    await input.runImmediateFullManagerCatchUp();
    return;
  }

  // Terrain commits before the staged manager fanout. Keep structure presentation
  // in lockstep with that terrain commit so buildings do not cull against stale
  // chunk bounds while the new biome slice is already visible.
  await input.runImmediateStructureCatchUp();
  input.scheduleDeferredRemainingManagerCatchUp();
}
