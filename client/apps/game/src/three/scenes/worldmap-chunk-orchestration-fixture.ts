import { resolveChunkSwitchActions } from "./worldmap-chunk-transition";
import { createControlledAsyncCall } from "./worldmap-test-harness";
import type { WorldmapBarrierResult } from "./worldmap-authoritative-barrier";

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
  presentationStatus: "ready" | "fetch_failed" | "timed_out" | "aborted";
  committedManagers: boolean;
  rolledBack: boolean;
  unregisteredPreviousChunk: boolean;
  committedChunk: string;
}

export function createWorldmapChunkOrchestrationFixture() {
  const tileFetch = createControlledAsyncCall<[string], boolean>();
  const tileHydration = createControlledAsyncCall<[string], WorldmapBarrierResult>();
  const boundsSwitch = createControlledAsyncCall<[string, number | undefined], void>();
  const structureHydration = createControlledAsyncCall<[string], WorldmapBarrierResult>();
  const assetPrewarm = createControlledAsyncCall<[string], void>();
  const terrainPreparation = createControlledAsyncCall<[number, number], { chunkKey: string }>();
  const managerUpdate = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();
  let currentChunk = "null";

  return {
    tileFetch,
    tileHydration,
    boundsSwitch,
    structureHydration,
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
      const tileFetchPromise = tileFetch.fn(input.chunkKey);
      const tileHydrationPromise = tileHydration.fn(input.chunkKey);
      const boundsSwitchPromise = boundsSwitch.fn(input.chunkKey, input.transitionToken);
      const structureHydrationPromise = structureHydration.fn(input.chunkKey);
      const assetPrewarmPromise = assetPrewarm.fn(input.chunkKey);

      void assetPrewarmPromise.catch(() => undefined);

      const [tileFetchSucceeded, tileHydrationResult, _boundsReady, structureHydrationResult] = await Promise.all([
        tileFetchPromise,
        tileHydrationPromise,
        boundsSwitchPromise,
        structureHydrationPromise,
      ]);

      const presentationStatus = resolvePresentationStatus({
        tileFetchSucceeded,
        tileHydrationResult,
        structureHydrationResult,
      });

      if (presentationStatus === "ready") {
        await terrainPreparation.fn(input.startRow, input.startCol);
      }

      const actions = resolveChunkSwitchActions({
        fetchSucceeded: presentationStatus === "ready" && tileFetchSucceeded,
        isCurrentTransition: input.isCurrentTransition,
        targetChunk: input.chunkKey,
        previousChunk,
      });

      if (actions.shouldRollback) {
        currentChunk = oldChunk;
        return {
          tileFetchSucceeded,
          presentationStatus,
          committedManagers: false,
          rolledBack: true,
          unregisteredPreviousChunk: false,
          committedChunk: currentChunk,
        };
      }

      if (!actions.shouldCommitManagers) {
        return {
          tileFetchSucceeded,
          presentationStatus,
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
        presentationStatus,
        committedManagers: actions.shouldCommitManagers,
        rolledBack: actions.shouldRollback,
        unregisteredPreviousChunk: actions.shouldUnregisterPreviousChunk,
        committedChunk: currentChunk,
      };
    },
  };
}

function resolvePresentationStatus(input: {
  tileFetchSucceeded: boolean;
  tileHydrationResult: WorldmapBarrierResult;
  structureHydrationResult: WorldmapBarrierResult;
}): "ready" | "fetch_failed" | "timed_out" | "aborted" {
  if (!input.tileFetchSucceeded) {
    return "fetch_failed";
  }

  if (input.tileHydrationResult.status !== "ready") {
    return input.tileHydrationResult.status;
  }

  if (input.structureHydrationResult.status !== "ready") {
    return input.structureHydrationResult.status;
  }

  return "ready";
}
