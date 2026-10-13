/**
 * When the local scene may be revealed: once its grid is built and its ground textures have settled. Textures that
 * failed still reveal (the terrain stays flat); a grid that failed to build fails the scene instead: there is no board
 * to reveal, and the entry waiting on it must say so.
 */
export async function awaitLocalScenePresentable(input: {
  gridBuilt: Promise<void>;
  groundTextures: Promise<void>;
}): Promise<void> {
  const [grid] = await Promise.allSettled([input.gridBuilt, input.groundTextures]);
  if (grid.status === "rejected") throw grid.reason;
}
