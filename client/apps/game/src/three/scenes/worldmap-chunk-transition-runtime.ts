export interface WorldmapChunkTransitionRuntimeState<TTransitionPromise = Promise<void>> {
  activePromise: TTransitionPromise | null;
  isTransitioning: boolean;
}

interface RunWorldmapChunkTransitionInput<TTransitionPromise extends Promise<unknown>, TResult> {
  onFinally?: () => void | Promise<void>;
  onResolved: () => TResult | Promise<TResult>;
  onTransitionStart?: () => void | Promise<void>;
  yieldFrame?: () => Promise<void>;
  state: WorldmapChunkTransitionRuntimeState<TTransitionPromise>;
  transitionPromise: TTransitionPromise;
}

export function createWorldmapChunkTransitionRuntimeState<
  TTransitionPromise = Promise<void>,
>(): WorldmapChunkTransitionRuntimeState<TTransitionPromise> {
  return {
    activePromise: null,
    isTransitioning: false,
  };
}

export async function runWorldmapChunkTransition<TTransitionPromise extends Promise<unknown>, TResult>(
  input: RunWorldmapChunkTransitionInput<TTransitionPromise, TResult>,
): Promise<TResult> {
  input.state.isTransitioning = true;
  input.state.activePromise = input.transitionPromise;
  await input.onTransitionStart?.();
  if (input.yieldFrame) {
    await input.yieldFrame();
  } else if (typeof requestAnimationFrame !== "undefined") {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  try {
    await input.transitionPromise;
    return await input.onResolved();
  } finally {
    await input.onFinally?.();
    input.state.activePromise = null;
    input.state.isTransitioning = false;
  }
}
