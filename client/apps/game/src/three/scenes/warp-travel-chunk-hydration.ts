export interface WarpTravelChunkHydrationInput {
  chunkKey: string;
  startRow: number;
  startCol: number;
  surroundingChunks: string[];
  transitionToken: number;
  renderSize: {
    height: number;
    width: number;
  };
  computeTileEntities: (chunkKey: string) => Promise<boolean>;
  updatePinnedChunks: (chunkKeys: string[]) => void;
  updateBoundsSubscription: (chunkKey: string, transitionToken: number) => Promise<void>;
  updateHexagonGrid: (startRow: number, startCol: number, height: number, width: number) => Promise<void>;
  onChunkHydrated: (chunkKey: string) => void;
}

export async function hydrateWarpTravelChunk(
  input: WarpTravelChunkHydrationInput,
): Promise<{ tileFetchSucceeded: boolean }> {
  const tileFetchPromise = input.computeTileEntities(input.chunkKey);

  input.updatePinnedChunks(input.surroundingChunks);
  const boundsSwitchPromise = input.updateBoundsSubscription(input.chunkKey, input.transitionToken);
  input.surroundingChunks.forEach((chunkKey) => {
    void input.computeTileEntities(chunkKey);
  });

  await input.updateHexagonGrid(input.startRow, input.startCol, input.renderSize.height, input.renderSize.width);

  const tileFetchSucceeded = await tileFetchPromise;
  await boundsSwitchPromise;
  input.onChunkHydrated(input.chunkKey);

  return {
    tileFetchSucceeded,
  };
}
