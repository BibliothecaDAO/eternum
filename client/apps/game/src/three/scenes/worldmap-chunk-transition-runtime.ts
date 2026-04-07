export interface WorldmapChunkTransitionRuntimeState<TTransitionPromise = Promise<void>> {
  activePromise: TTransitionPromise | null;
  isTransitioning: boolean;
}

interface RunWorldmapChunkTransitionInput<TTransitionPromise extends Promise<unknown>, TResult> {
  onFinally?: () => void | Promise<void>;
  onResolved: () => TResult | Promise<TResult>;
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

  try {
    await input.transitionPromise;
    return await input.onResolved();
  } finally {
    await input.onFinally?.();
    input.state.activePromise = null;
    input.state.isTransitioning = false;
  }
}
