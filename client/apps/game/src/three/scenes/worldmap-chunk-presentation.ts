import type { WorldmapBarrierResult } from "./worldmap-authoritative-barrier";

interface PrepareWorldmapChunkPresentationInput<TPreparedTerrain> {
  chunkKey: string;
  startRow: number;
  startCol: number;
  renderSize: {
    height: number;
    width: number;
  };
  tileFetchPromise: Promise<boolean>;
  tileHydrationReadyPromise: Promise<WorldmapBarrierResult>;
  boundsReadyPromise: Promise<void>;
  structureReadyPromise: Promise<WorldmapBarrierResult>;
  prepareTerrainChunk: (startRow: number, startCol: number, height: number, width: number) => Promise<TPreparedTerrain>;
  onChunkReady?: (chunkKey: string) => void;
}

interface PreparedWorldmapChunkPresentation<TPreparedTerrain> {
  tileFetchSucceeded: boolean;
  preparedTerrain: TPreparedTerrain | null;
  presentationStatus: "ready" | "fetch_failed" | "timed_out" | "aborted";
}

interface PresentationGateResult {
  status: "ready" | "timed_out" | "aborted";
  tileFetchSucceeded: boolean;
}

interface SettledPresentationTask<TValue> {
  ok: boolean;
  value?: TValue;
  error?: unknown;
}

interface PrewarmWorldmapChunkPresentationInput<TPreparedTerrain> {
  chunkKey: string;
  prewarmToken: number;
  isLatestToken: (token: number) => boolean;
  isPresentationHot: (chunkKey: string) => boolean;
  preparePresentation: () => Promise<PreparedWorldmapChunkPresentation<TPreparedTerrain>>;
  cachePreparedTerrain: (preparedTerrain: TPreparedTerrain) => void;
}

interface PrewarmedWorldmapChunkPresentation<TPreparedTerrain> {
  status: "prepared" | "skipped_hot" | "stale_dropped" | "fetch_failed";
  preparedTerrain: TPreparedTerrain | null;
}

export async function prepareWorldmapChunkPresentation<TPreparedTerrain>(
  input: PrepareWorldmapChunkPresentationInput<TPreparedTerrain>,
): Promise<PreparedWorldmapChunkPresentation<TPreparedTerrain>> {
  const tileFetchTask = settlePresentationTask(input.tileFetchPromise);
  const boundsReadyTask = settlePresentationTask(input.boundsReadyPromise);
  const presentationGate = await resolvePresentationGate({
    tileHydrationReadyPromise: input.tileHydrationReadyPromise,
    structureReadyPromise: input.structureReadyPromise,
  });

  if (presentationGate.status !== "ready") {
    input.onChunkReady?.(input.chunkKey);
    return {
      tileFetchSucceeded: presentationGate.tileFetchSucceeded,
      preparedTerrain: null,
      presentationStatus: presentationGate.status,
    };
  }

  const [tileFetchResult, boundsReadyResult] = await Promise.all([tileFetchTask, boundsReadyTask]);
  if (!tileFetchResult.ok) {
    throw tileFetchResult.error;
  }

  if (!boundsReadyResult.ok) {
    throw boundsReadyResult.error;
  }

  const tileFetchSucceeded = tileFetchResult.value ?? false;

  if (!tileFetchSucceeded) {
    input.onChunkReady?.(input.chunkKey);
    return {
      tileFetchSucceeded: false,
      preparedTerrain: null,
      presentationStatus: "fetch_failed",
    };
  }

  const preparedTerrain = await input.prepareTerrainChunk(
    input.startRow,
    input.startCol,
    input.renderSize.height,
    input.renderSize.width,
  );
  input.onChunkReady?.(input.chunkKey);

  return {
    tileFetchSucceeded: true,
    preparedTerrain,
    presentationStatus: "ready",
  };
}

export async function prewarmWorldmapChunkPresentation<TPreparedTerrain>(
  input: PrewarmWorldmapChunkPresentationInput<TPreparedTerrain>,
): Promise<PrewarmedWorldmapChunkPresentation<TPreparedTerrain>> {
  if (input.isPresentationHot(input.chunkKey)) {
    return {
      status: "skipped_hot",
      preparedTerrain: null,
    };
  }

  const preparedPresentation = await input.preparePresentation();
  if (preparedPresentation.presentationStatus !== "ready" || preparedPresentation.preparedTerrain === null) {
    return {
      status: "fetch_failed",
      preparedTerrain: null,
    };
  }

  if (!input.isLatestToken(input.prewarmToken)) {
    return {
      status: "stale_dropped",
      preparedTerrain: null,
    };
  }

  if (input.isPresentationHot(input.chunkKey)) {
    return {
      status: "skipped_hot",
      preparedTerrain: null,
    };
  }

  input.cachePreparedTerrain(preparedPresentation.preparedTerrain);
  return {
    status: "prepared",
    preparedTerrain: preparedPresentation.preparedTerrain,
  };
}

async function resolvePresentationGate(input: {
  tileHydrationReadyPromise: Promise<WorldmapBarrierResult>;
  structureReadyPromise: Promise<WorldmapBarrierResult>;
}): Promise<PresentationGateResult> {
  const [tileBarrierResult, structureBarrierResult] = await Promise.all([
    input.tileHydrationReadyPromise,
    input.structureReadyPromise,
  ]);

  if (tileBarrierResult.status !== "ready") {
    return {
      status: tileBarrierResult.status,
      tileFetchSucceeded: false,
    };
  }

  if (structureBarrierResult.status !== "ready") {
    return {
      status: structureBarrierResult.status,
      tileFetchSucceeded: false,
    };
  }

  return {
    status: "ready",
    tileFetchSucceeded: false,
  };
}

function settlePresentationTask<TValue>(promise: Promise<TValue>): Promise<SettledPresentationTask<TValue>> {
  return promise.then(
    (value) => ({
      ok: true,
      value,
    }),
    (error) => ({
      ok: false,
      error,
    }),
  );
}
