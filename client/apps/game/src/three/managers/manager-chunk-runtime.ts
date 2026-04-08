export interface ManagerChunkUpdateOptions {
  force?: boolean;
  transitionToken?: number;
}

export interface ManagerChunkRuntimeState {
  currentChunk: string | null;
  inFlightPromise: Promise<void> | null;
  latestTransitionToken: number;
  transitionChunkByToken: Map<number, string>;
}

interface BindManagerChunkRuntimeStateInput {
  getCurrentChunk: () => string | null;
  setCurrentChunk: (chunkKey: string | null) => void;
  getInFlightPromise: () => Promise<void> | null;
  setInFlightPromise: (promise: Promise<void> | null) => void;
  getLatestTransitionToken: () => number;
  setLatestTransitionToken: (transitionToken: number) => void;
  transitionChunkByToken: Map<number, string>;
}

interface ManagerChunkRequest {
  chunkKey: string;
  transitionToken?: number;
  knownChunkForToken?: string;
  latestTransitionToken: number;
}

interface RunManagerChunkUpdateRuntimeInput {
  chunkKey: string;
  executeChunkUpdate: (chunkKey: string, options?: ManagerChunkUpdateOptions) => Promise<void | false> | void | false;
  isDestroyed?: () => boolean;
  onPreviousUpdateFailed?: (error: unknown) => void;
  options?: ManagerChunkUpdateOptions;
  prepareForUpdate?: () => Promise<void> | void;
  shouldAcceptRequest: (request: ManagerChunkRequest) => boolean;
  state: ManagerChunkRuntimeState;
  waitForSettle?: () => Promise<void> | void;
}

export function createManagerChunkRuntimeState(currentChunk: string | null): ManagerChunkRuntimeState {
  return {
    currentChunk,
    inFlightPromise: null,
    latestTransitionToken: 0,
    transitionChunkByToken: new Map(),
  };
}

export function bindManagerChunkRuntimeState(input: BindManagerChunkRuntimeStateInput): ManagerChunkRuntimeState {
  return {
    get currentChunk() {
      return input.getCurrentChunk();
    },
    set currentChunk(chunkKey: string | null) {
      input.setCurrentChunk(chunkKey);
    },
    get inFlightPromise() {
      return input.getInFlightPromise();
    },
    set inFlightPromise(promise: Promise<void> | null) {
      input.setInFlightPromise(promise);
    },
    get latestTransitionToken() {
      return input.getLatestTransitionToken();
    },
    set latestTransitionToken(transitionToken: number) {
      input.setLatestTransitionToken(transitionToken);
    },
    transitionChunkByToken: input.transitionChunkByToken,
  };
}

export async function runManagerChunkUpdateRuntime(input: RunManagerChunkUpdateRuntimeInput): Promise<void> {
  if (isManagerChunkRuntimeDestroyed(input.isDestroyed)) {
    return;
  }

  const state = input.state;
  const transitionRequest = registerChunkTransitionRequest(state, input.chunkKey, input.options?.transitionToken);
  if (!input.shouldAcceptRequest(transitionRequest)) {
    return;
  }

  trackAcceptedChunkTransition(state, input.chunkKey, input.options?.transitionToken);
  await input.prepareForUpdate?.();

  if (isManagerChunkRuntimeDestroyed(input.isDestroyed)) {
    return;
  }

  if (shouldSkipUnforcedChunkRefresh(state.currentChunk, input.chunkKey, input.options?.force)) {
    return;
  }

  await waitForPreviousChunkUpdate(state.inFlightPromise, input.onPreviousUpdateFailed);

  if (isManagerChunkRuntimeDestroyed(input.isDestroyed)) {
    return;
  }

  if (shouldSkipUnforcedChunkRefresh(state.currentChunk, input.chunkKey, input.options?.force)) {
    return;
  }

  if (
    !input.shouldAcceptRequest(registerChunkTransitionRequest(state, input.chunkKey, input.options?.transitionToken))
  ) {
    return;
  }

  const runtimeOptions = resolveChunkUpdateOptions(state.currentChunk, input.chunkKey, input.options);
  commitNextChunk(state, input.chunkKey, runtimeOptions.force);
  const trackedChunkUpdate = Promise.resolve(input.executeChunkUpdate(input.chunkKey, runtimeOptions)).then(
    async (shouldSettle) => {
      if (shouldSettle === false) {
        return;
      }

      await input.waitForSettle?.();
    },
  );
  state.inFlightPromise = trackedChunkUpdate;

  try {
    await trackedChunkUpdate;
  } finally {
    if (state.inFlightPromise === trackedChunkUpdate) {
      state.inFlightPromise = null;
    }
  }
}

function registerChunkTransitionRequest(
  state: ManagerChunkRuntimeState,
  chunkKey: string,
  transitionToken: number | undefined,
): ManagerChunkRequest {
  return {
    chunkKey,
    transitionToken,
    latestTransitionToken: state.latestTransitionToken,
    knownChunkForToken: transitionToken !== undefined ? state.transitionChunkByToken.get(transitionToken) : undefined,
  };
}

function isManagerChunkRuntimeDestroyed(isDestroyed: (() => boolean) | undefined): boolean {
  return isDestroyed?.() ?? false;
}

function trackAcceptedChunkTransition(
  state: ManagerChunkRuntimeState,
  chunkKey: string,
  transitionToken: number | undefined,
): void {
  if (transitionToken === undefined) {
    return;
  }

  state.latestTransitionToken = Math.max(state.latestTransitionToken, transitionToken);
  state.transitionChunkByToken.set(transitionToken, chunkKey);
  pruneTransitionChunkHistory(state);
}

function pruneTransitionChunkHistory(state: ManagerChunkRuntimeState): void {
  state.transitionChunkByToken.forEach((_, token) => {
    if (token < state.latestTransitionToken) {
      state.transitionChunkByToken.delete(token);
    }
  });
}

function shouldSkipUnforcedChunkRefresh(
  currentChunk: string | null,
  chunkKey: string,
  force: boolean | undefined,
): boolean {
  return !force && currentChunk === chunkKey;
}

async function waitForPreviousChunkUpdate(
  previousUpdate: Promise<void> | null,
  onPreviousUpdateFailed: ((error: unknown) => void) | undefined,
): Promise<void> {
  if (!previousUpdate) {
    return;
  }

  try {
    await previousUpdate;
  } catch (error) {
    onPreviousUpdateFailed?.(error);
  }
}

function resolveChunkUpdateOptions(
  currentChunk: string | null,
  chunkKey: string,
  options: ManagerChunkUpdateOptions | undefined,
): ManagerChunkUpdateOptions {
  return {
    force: options?.force || currentChunk !== chunkKey,
    transitionToken: options?.transitionToken,
  };
}

function commitNextChunk(state: ManagerChunkRuntimeState, chunkKey: string, force: boolean | undefined): void {
  if (!force && state.currentChunk === chunkKey) {
    return;
  }

  state.currentChunk = chunkKey;
}
