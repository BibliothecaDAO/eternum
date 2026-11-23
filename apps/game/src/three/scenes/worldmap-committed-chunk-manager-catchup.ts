interface CatchUpCommittedWorldmapChunkManagersInput {
  runImmediateFullManagerCatchUp: () => Promise<void>;
  runImmediateCriticalManagerCatchUp: () => Promise<void>;
  stagedPathEnabled: boolean;
}

export async function catchUpCommittedWorldmapChunkManagers(
  input: CatchUpCommittedWorldmapChunkManagersInput,
): Promise<void> {
  if (!input.stagedPathEnabled) {
    await input.runImmediateFullManagerCatchUp();
    return;
  }

  await input.runImmediateCriticalManagerCatchUp();
}
