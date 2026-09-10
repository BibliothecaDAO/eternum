/**
 * When the local scene may be revealed: after its grid is built and its ground textures have settled, and after
 * the renderer has compiled every pipeline the first frame would otherwise compile on screen. A warm-up that
 * fails, or that outlives its budget (async pipeline creation can take seconds on a software backend), still
 * reveals: an uncompiled first frame is a hitch, a frozen snapshot is a bug.
 */
export const LOCAL_SCENE_WARM_UP_BUDGET_MS = 1_500;

export async function awaitLocalScenePresentable(input: {
  gridBuilt: Promise<void>;
  groundTextures: Promise<void>;
  compile: () => Promise<void>;
  budgetMs?: number;
  setTimeoutFn?: (callback: () => void, delayMs: number) => void;
}): Promise<void> {
  await Promise.allSettled([input.gridBuilt, input.groundTextures]);
  const schedule = input.setTimeoutFn ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const budget = new Promise<"budget">((resolve) =>
    schedule(() => resolve("budget"), input.budgetMs ?? LOCAL_SCENE_WARM_UP_BUDGET_MS),
  );
  const compile = input.compile().then(
    () => "compiled" as const,
    (error: unknown) => {
      console.warn("[Hexception] pipeline warm-up failed; the first frame compiles on screen", error);
      return "failed" as const;
    },
  );
  if ((await Promise.race([compile, budget])) === "budget") {
    console.warn(
      `[Hexception] pipeline warm-up outlived its ${input.budgetMs ?? LOCAL_SCENE_WARM_UP_BUDGET_MS}ms budget; revealing`,
    );
  }
}
