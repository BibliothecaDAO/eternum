import { deriveDirectionalPrefetchChunkKeys } from "./worldmap-directional-prefetch-policy";

interface WarpTravelDirectionalPrefetchAnchor {
  forwardChunkKey: string;
  movementAxis: "x" | "z";
  movementSign: -1 | 1;
}

interface ResolveWarpTravelDirectionalPrefetchPlanInput {
  anchor: WarpTravelDirectionalPrefetchAnchor | null;
  chunkSize: number;
  forwardDepthStrides: number;
  sideRadiusStrides: number;
  areaBoundaryLookaheadStrides?: number;
  projectionSuperAreaStrides?: number;
  pinnedChunkKeys: Set<string>;
  currentChunk: string;
  prefetchedAhead: string[];
  maxPrefetchedAhead: number;
  getRenderAreaKeyForChunk: (chunkKey: string) => string;
}

function parseChunkKey(chunkKey: string): { row: number; col: number } {
  const [row, col] = chunkKey.split(",").map(Number);
  return { row, col };
}

function resolveBoundaryPrefetchChunkKey(input: ResolveWarpTravelDirectionalPrefetchPlanInput): string | null {
  const { anchor, areaBoundaryLookaheadStrides, chunkSize, currentChunk, projectionSuperAreaStrides } = input;
  if (!anchor || !areaBoundaryLookaheadStrides || !projectionSuperAreaStrides) {
    return null;
  }

  const { row, col } = parseChunkKey(currentChunk);
  const strideIndex = anchor.movementAxis === "x" ? col / chunkSize : row / chunkSize;
  if (!Number.isFinite(strideIndex)) {
    return null;
  }

  const areaStartIndex = Math.floor(strideIndex / projectionSuperAreaStrides) * projectionSuperAreaStrides;
  const distanceToBoundary =
    anchor.movementSign > 0
      ? areaStartIndex + projectionSuperAreaStrides - 1 - strideIndex
      : strideIndex - areaStartIndex;

  if (distanceToBoundary > areaBoundaryLookaheadStrides) {
    return null;
  }

  const boundaryStrideIndex =
    anchor.movementSign > 0 ? areaStartIndex + projectionSuperAreaStrides : areaStartIndex - projectionSuperAreaStrides;
  const boundaryRow = anchor.movementAxis === "z" ? boundaryStrideIndex * chunkSize : row;
  const boundaryCol = anchor.movementAxis === "x" ? boundaryStrideIndex * chunkSize : col;
  return `${boundaryRow},${boundaryCol}`;
}

function appendFetchPrefetchTarget(
  chunkKey: string,
  input: ResolveWarpTravelDirectionalPrefetchPlanInput,
  output: {
    chunkKeysToEnqueue: string[];
    desiredAreaKeys: string[];
    nextPrefetchedAhead: string[];
  },
): void {
  if (input.pinnedChunkKeys.has(chunkKey) || chunkKey === input.currentChunk) {
    return;
  }

  output.desiredAreaKeys.push(input.getRenderAreaKeyForChunk(chunkKey));
  if (output.nextPrefetchedAhead.includes(chunkKey)) {
    return;
  }

  output.nextPrefetchedAhead.push(chunkKey);
  while (output.nextPrefetchedAhead.length > input.maxPrefetchedAhead) {
    output.nextPrefetchedAhead.shift();
  }
  output.chunkKeysToEnqueue.push(chunkKey);
}

export function resolveWarpTravelDirectionalPrefetchPlan(input: ResolveWarpTravelDirectionalPrefetchPlanInput): {
  desiredAreaKeys: string[];
  chunkKeysToEnqueue: string[];
  presentationChunkKeysToPrewarm: string[];
  nextPrefetchedAhead: string[];
} {
  if (!input.anchor) {
    return {
      desiredAreaKeys: [],
      chunkKeysToEnqueue: [],
      presentationChunkKeysToPrewarm: [],
      nextPrefetchedAhead: [],
    };
  }

  const prefetchTargets = deriveDirectionalPrefetchChunkKeys({
    forwardChunkKey: input.anchor.forwardChunkKey,
    chunkSize: input.chunkSize,
    forwardDepthStrides: input.forwardDepthStrides,
    sideRadiusStrides: input.sideRadiusStrides,
    movementAxis: input.anchor.movementAxis,
    movementSign: input.anchor.movementSign,
  });

  const desiredAreaKeys: string[] = [];
  const nextPrefetchedAhead = [...input.prefetchedAhead];
  const chunkKeysToEnqueue: string[] = [];
  const { row: forwardRow, col: forwardCol } = parseChunkKey(input.anchor.forwardChunkKey);
  const presentationChunkKeysToPrewarm: string[] = [];

  for (let forwardStride = 0; forwardStride <= input.forwardDepthStrides; forwardStride += 1) {
    const row =
      input.anchor.movementAxis === "z"
        ? forwardRow + forwardStride * input.anchor.movementSign * input.chunkSize
        : forwardRow;
    const col =
      input.anchor.movementAxis === "x"
        ? forwardCol + forwardStride * input.anchor.movementSign * input.chunkSize
        : forwardCol;
    const chunkKey = `${row},${col}`;
    if (!input.pinnedChunkKeys.has(chunkKey) && chunkKey !== input.currentChunk) {
      presentationChunkKeysToPrewarm.push(chunkKey);
    }
  }

  prefetchTargets.forEach((chunkKey) => {
    appendFetchPrefetchTarget(chunkKey, input, {
      chunkKeysToEnqueue,
      desiredAreaKeys,
      nextPrefetchedAhead,
    });
  });

  const boundaryPrefetchChunkKey = resolveBoundaryPrefetchChunkKey(input);
  if (boundaryPrefetchChunkKey && !prefetchTargets.includes(boundaryPrefetchChunkKey)) {
    appendFetchPrefetchTarget(boundaryPrefetchChunkKey, input, {
      chunkKeysToEnqueue,
      desiredAreaKeys,
      nextPrefetchedAhead,
    });
  }

  return {
    desiredAreaKeys,
    chunkKeysToEnqueue,
    presentationChunkKeysToPrewarm,
    nextPrefetchedAhead,
  };
}
