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
  projectionSyncSucceeded: boolean;
  committedManagers: boolean;
  rolledBack: boolean;
  unregisteredPreviousChunk: boolean;
  committedChunk: string;
}

export function createWorldmapChunkOrchestrationFixture() {
  const projectionSync = createControlledAsyncCall<[string], boolean>();
  const assetPrewarm = createControlledAsyncCall<[string], void>();
  const terrainPreparation = createControlledAsyncCall<[number, number], { chunkKey: string }>();
  const managerUpdate = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();
  let currentChunk = "null";

  return {
    projectionSync,
    assetPrewarm,
    terrainPreparation,
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
      const projectionSyncPromise = projectionSync.fn(input.chunkKey);
      const assetPrewarmPromise = assetPrewarm.fn(input.chunkKey);

      const [projectionSyncSucceeded] = await Promise.all([projectionSyncPromise, assetPrewarmPromise]);
      if (projectionSyncSucceeded) {
        await terrainPreparation.fn(input.startRow, input.startCol);
      }

      const actions = resolveChunkSwitchActions({
        projectionSyncSucceeded: projectionSyncSucceeded,
        isCurrentTransition: input.isCurrentTransition,
        targetChunk: input.chunkKey,
        previousChunk,
      });

      if (actions.shouldRollback) {
        currentChunk = oldChunk;
        return {
          projectionSyncSucceeded,
          committedManagers: false,
          rolledBack: true,
          unregisteredPreviousChunk: false,
          committedChunk: currentChunk,
        };
      }

      if (!actions.shouldCommitManagers) {
        return {
          projectionSyncSucceeded,
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
        projectionSyncSucceeded,
        committedManagers: actions.shouldCommitManagers,
        rolledBack: actions.shouldRollback,
        unregisteredPreviousChunk: actions.shouldUnregisterPreviousChunk,
        committedChunk: currentChunk,
      };
    },
  };
}
