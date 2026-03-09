interface CachedTerrainSnapshotInput {
  totalCachedTerrainInstances: number;
  renderHexCapacity: number;
  minCoverageFraction: number;
}

interface CachedExploredTerrainSnapshotInput {
  cachedExploredTerrainInstances: number;
  expectedExploredTerrainInstances: number;
  minRetentionFraction: number;
  minExpectedExploredInstances: number;
}

interface SpectatorTileCoverageInput {
  resolvedTileInstances: number;
  expectedVisibleTerrainInstances: number;
  minCoverageFraction: number;
  minExpectedVisibleTerrainInstances: number;
}

interface CachedSpectatorTerrainSnapshotInput {
  outlineTerrainInstances: number;
  expectedVisibleTerrainInstances: number;
  maxOutlineFraction: number;
  minExpectedVisibleTerrainInstances: number;
}

export function shouldRejectCachedTerrainSnapshot(input: CachedTerrainSnapshotInput): boolean {
  const totalCachedTerrainInstances = Math.max(0, Math.floor(input.totalCachedTerrainInstances));
  const renderHexCapacity = Math.max(1, Math.floor(input.renderHexCapacity));
  const minCoverageFraction = Math.min(1, Math.max(0, input.minCoverageFraction));
  const minExpectedTerrainInstances = Math.ceil(renderHexCapacity * minCoverageFraction);

  return totalCachedTerrainInstances < minExpectedTerrainInstances;
}

export function shouldRejectCachedExploredTerrainSnapshot(input: CachedExploredTerrainSnapshotInput): boolean {
  const cachedExploredTerrainInstances = Math.max(0, Math.floor(input.cachedExploredTerrainInstances));
  const expectedExploredTerrainInstances = Math.max(0, Math.floor(input.expectedExploredTerrainInstances));
  const minExpectedExploredInstances = Math.max(0, Math.floor(input.minExpectedExploredInstances));

  if (expectedExploredTerrainInstances < minExpectedExploredInstances) {
    return false;
  }

  const minRetentionFraction = Math.min(1, Math.max(0, input.minRetentionFraction));
  const minRetainedExploredInstances = Math.ceil(expectedExploredTerrainInstances * minRetentionFraction);
  return cachedExploredTerrainInstances < minRetainedExploredInstances;
}

export function hasSufficientSpectatorTileCoverage(input: SpectatorTileCoverageInput): boolean {
  const resolvedTileInstances = Math.max(0, Math.floor(input.resolvedTileInstances));
  const expectedVisibleTerrainInstances = Math.max(0, Math.floor(input.expectedVisibleTerrainInstances));
  const minExpectedVisibleTerrainInstances = Math.max(0, Math.floor(input.minExpectedVisibleTerrainInstances));

  if (expectedVisibleTerrainInstances < minExpectedVisibleTerrainInstances) {
    return true;
  }

  const minCoverageFraction = Math.min(1, Math.max(0, input.minCoverageFraction));
  const minResolvedTileInstances = Math.ceil(expectedVisibleTerrainInstances * minCoverageFraction);
  return resolvedTileInstances >= minResolvedTileInstances;
}

export function shouldRejectCachedSpectatorTerrainSnapshot(input: CachedSpectatorTerrainSnapshotInput): boolean {
  const outlineTerrainInstances = Math.max(0, Math.floor(input.outlineTerrainInstances));
  const expectedVisibleTerrainInstances = Math.max(0, Math.floor(input.expectedVisibleTerrainInstances));
  const minExpectedVisibleTerrainInstances = Math.max(0, Math.floor(input.minExpectedVisibleTerrainInstances));

  if (expectedVisibleTerrainInstances < minExpectedVisibleTerrainInstances) {
    return false;
  }

  const maxOutlineFraction = Math.min(1, Math.max(0, input.maxOutlineFraction));
  const maxOutlineInstances = Math.floor(expectedVisibleTerrainInstances * maxOutlineFraction);
  return outlineTerrainInstances > maxOutlineInstances;
}
