import { resolveChunkSwitchActions } from "./worldmap-chunk-transition";
import { createControlledAsyncCall } from "./worldmap-test-harness";

interface RunChunkSwitchInput {
  chunkKey: string;
  startRow: number;
  startCol: number;
  force: boolean;
  transitionToken: number;
  isCurrentTransition: boolean;
  previousChunk?: string | null;
  currentChunk?: string;
}

interface RunChunkSwitchResult {
  tileFetchSucceeded: boolean;
  committedManagers: boolean;
  rolledBack: boolean;
  unregisteredPreviousChunk: boolean;
  committedChunk: string;
}

export function createWorldmapChunkOrchestrationFixture() {
  const tileFetch = createControlledAsyncCall<[string], boolean>();
  const boundsSwitch = createControlledAsyncCall<[string, number | undefined], void>();
  const gridUpdate = createControlledAsyncCall<[number, number], void>();
  const managerUpdate = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();
  let currentChunk = "null";

  return {
    tileFetch,
    boundsSwitch,
    gridUpdate,
    managerUpdate,
    getCurrentChunk() {
      return currentChunk;
    },
    async runChunkSwitch(input: RunChunkSwitchInput): Promise<RunChunkSwitchResult> {
      if (input.currentChunk !== undefined) {
        currentChunk = input.currentChunk;
      }
      const previousChunk = input.previousChunk ?? currentChunk;
      const oldChunk = currentChunk;
      const tileFetchPromise = tileFetch.fn(input.chunkKey);
      const boundsSwitchPromise = boundsSwitch.fn(input.chunkKey, input.transitionToken);

      await gridUpdate.fn(input.startRow, input.startCol);

      const tileFetchSucceeded = await tileFetchPromise;
      await boundsSwitchPromise;

      const actions = resolveChunkSwitchActions({
        fetchSucceeded: tileFetchSucceeded,
        isCurrentTransition: input.isCurrentTransition,
        targetChunk: input.chunkKey,
        previousChunk,
      });

      if (actions.shouldRollback) {
        currentChunk = oldChunk;
        return {
          tileFetchSucceeded,
          committedManagers: false,
          rolledBack: true,
          unregisteredPreviousChunk: false,
          committedChunk: currentChunk,
        };
      }

      if (!actions.shouldCommitManagers) {
        return {
          tileFetchSucceeded,
          committedManagers: false,
          rolledBack: false,
          unregisteredPreviousChunk: false,
          committedChunk: currentChunk,
        };
      }

      currentChunk = input.chunkKey;

      await managerUpdate.fn(input.chunkKey, {
        force: input.force,
        transitionToken: input.transitionToken,
      });

      return {
        tileFetchSucceeded,
        committedManagers: actions.shouldCommitManagers,
        rolledBack: actions.shouldRollback,
        unregisteredPreviousChunk: actions.shouldUnregisterPreviousChunk,
        committedChunk: currentChunk,
      };
    },
  };
}
