interface CatchUpCommittedWorldmapChunkManagersInput {
  runImmediateFullManagerCatchUp: () => Promise<void>;
  runImmediateCriticalManagerCatchUp: () => Promise<void>;
  scheduleDeferredNonCriticalManagerCatchUp: () => void;
  stagedPathEnabled: boolean;
}

export async function catchUpCommittedWorldmapChunkManagers(
  input: CatchUpCommittedWorldmapChunkManagersInput,
): Promise<void> {
  if (!input.stagedPathEnabled) {
    await input.runImmediateFullManagerCatchUp();
    return;
  }

  // Terrain commits before the staged manager fanout. Keep critical visible
  // managers in lockstep with that terrain commit so the current chunk
  // does not present mixed terrain/entity state while deferred work drains.
  await input.runImmediateCriticalManagerCatchUp();
  input.scheduleDeferredNonCriticalManagerCatchUp();
}
