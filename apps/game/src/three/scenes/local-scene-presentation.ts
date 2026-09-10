/**
 * When the local scene may be revealed: after its grid is built and its ground textures have settled, and after
 * the renderer has compiled every pipeline the first frame would otherwise compile on screen. A failed warm-up
 * still reveals: an uncompiled first frame is a hitch, a frozen snapshot is a bug.
 */
export async function awaitLocalScenePresentable(input: {
  gridBuilt: Promise<void>;
  groundTextures: Promise<void>;
  compile: () => Promise<void>;
}): Promise<void> {
  await Promise.allSettled([input.gridBuilt, input.groundTextures]);
  try {
    await input.compile();
  } catch (error) {
    console.warn("[Hexception] pipeline warm-up failed; the first frame compiles on screen", error);
  }
}
